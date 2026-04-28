#!/usr/bin/env node
// Post-build static audit for dist/**/*.html.
//
// Enforces the SEO, social, structured-data, anchor, image, and asset
// invariants established in R1.4 so the marketing site can't silently
// regress those guarantees. The audit runs after `astro build` (locally
// via `npm run build` and in CI) and mirrors the manual curl+rg checks
// that were used to verify the initial launch.
//
// Intentionally dependency-light: only `node-html-parser` (devDep) is
// used. No color output — CI logs stay readable when scrollback is
// rehydrated elsewhere.

import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, relative, sep, posix } from "node:path";
import { parse as parseHTML } from "node-html-parser";

const SITE_ORIGIN = "https://getbudi.dev";

const REQUIRED_ICONS = [
  { name: "og.png", width: 1200, height: 630 },
  { name: "icon-192.png", width: 192, height: 192 },
  { name: "icon-512.png", width: 512, height: 512 },
  { name: "apple-touch-icon.png", width: 180, height: 180 },
  { name: "favicon.svg" }, // SVG — no dimension check, only existence + non-zero.
];

// Pages that intentionally opt out of indexing. Keys are forward-slash
// paths relative to `dist/` (no leading slash). A page listed here must
// carry `<meta name="robots" content*=noindex>`; any page NOT listed
// must NOT carry a robots meta tag so crawlers default to indexable.
const NOINDEX_PAGES = new Set(["404.html"]);

const distRoot = process.argv[2] ?? "dist";

if (!existsSync(distRoot) || !statSync(distRoot).isDirectory()) {
  console.error(`audit: dist directory not found at ${distRoot}`);
  process.exit(1);
}

let passed = 0;
let failed = 0;

/**
 * Record a single named check result. Output is stable across runs so
 * CI log diffs stay reviewable.
 */
function check(ok, label, where) {
  const loc = where ? ` (${where})` : "";
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${label}${loc}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}${loc}`);
  }
}

function walkHtml(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip Astro's hashed asset dir — it doesn't contain pages.
      if (entry.name === "_astro") continue;
      out.push(...walkHtml(full));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Derive the canonical URL for a built page from its file path within
 * dist/. Mirrors Astro's static output layout:
 *   dist/index.html        → https://getbudi.dev/
 *   dist/404.html          → https://getbudi.dev/404
 *   dist/foo/index.html    → https://getbudi.dev/foo/
 *   dist/foo/bar.html      → https://getbudi.dev/foo/bar
 */
function canonicalForFile(filePath) {
  const rel = relative(distRoot, filePath).split(sep).join(posix.sep);
  if (rel === "index.html") return `${SITE_ORIGIN}/`;
  if (rel.endsWith("/index.html")) {
    return `${SITE_ORIGIN}/${rel.slice(0, -"index.html".length)}`;
  }
  return `${SITE_ORIGIN}/${rel.replace(/\.html$/, "")}`;
}

/**
 * Confirm that an absolute asset URL resolves to a real file inside
 * dist/. Only URLs served from the site origin are resolved here;
 * anything else is rejected at the caller.
 */
function assetExistsInDist(absoluteUrl) {
  if (!absoluteUrl.startsWith(`${SITE_ORIGIN}/`)) return false;
  const pathname = absoluteUrl.slice(SITE_ORIGIN.length).split("?")[0].split("#")[0];
  const local = join(distRoot, pathname.replace(/^\//, ""));
  return existsSync(local) && statSync(local).isFile();
}

/**
 * Read PNG width/height from the IHDR chunk. Avoids pulling in a full
 * image library just to sniff 8 bytes.
 */
function pngDimensions(filePath) {
  const buf = readFileSync(filePath);
  if (buf.length < 24) return null;
  const isPng =
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a;
  if (!isPng) return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

function auditPage(filePath) {
  const rel = relative(distRoot, filePath).split(sep).join(posix.sep);
  const html = readFileSync(filePath, "utf8");
  const root = parseHTML(html, {
    blockTextElements: { script: true, style: true },
  });

  // 1. Canonical link: exactly one, matches derived URL.
  const canonicalLinks = root.querySelectorAll('link[rel="canonical"]');
  check(canonicalLinks.length === 1, "canonical present and unique", rel);
  if (canonicalLinks.length === 1) {
    const actual = canonicalLinks[0].getAttribute("href");
    const expected = canonicalForFile(filePath);
    check(actual === expected, `canonical href = ${expected}`, rel);
  }

  // 2. Title.
  const title = root.querySelector("title");
  check(title !== null && title.text.trim().length > 0, "title present and non-empty", rel);

  // 3. Description 50–200 chars.
  const descMeta = root.querySelector('meta[name="description"]');
  const desc = descMeta?.getAttribute("content")?.trim() ?? "";
  check(
    desc.length >= 50 && desc.length <= 200,
    `description length in 50..200 (got ${desc.length})`,
    rel,
  );

  // 4. OG tags complete.
  const ogRequired = [
    "og:title",
    "og:description",
    "og:url",
    "og:image",
    "og:image:width",
    "og:image:height",
    "og:image:alt",
  ];
  for (const prop of ogRequired) {
    const m = root.querySelector(`meta[property="${prop}"]`);
    const value = m?.getAttribute("content")?.trim() ?? "";
    check(value.length > 0, `${prop} present`, rel);
  }

  // 5. Twitter tags complete, card = summary_large_image.
  const twCard = root.querySelector('meta[name="twitter:card"]')?.getAttribute("content");
  check(twCard === "summary_large_image", "twitter:card = summary_large_image", rel);
  for (const name of [
    "twitter:title",
    "twitter:description",
    "twitter:image",
    "twitter:image:alt",
  ]) {
    const m = root.querySelector(`meta[name="${name}"]`);
    const value = m?.getAttribute("content")?.trim() ?? "";
    check(value.length > 0, `${name} present`, rel);
  }

  // 6. Social image URLs are absolute, under our origin, and resolve
  // to a real file in dist/.
  const ogImage = root.querySelector('meta[property="og:image"]')?.getAttribute("content");
  const twImage = root.querySelector('meta[name="twitter:image"]')?.getAttribute("content");
  for (const [label, url] of [
    ["og:image", ogImage],
    ["twitter:image", twImage],
  ]) {
    if (!url) continue; // Missing-ness already surfaced above.
    const absolute = url.startsWith(`${SITE_ORIGIN}/`);
    check(absolute, `${label} absolute under ${SITE_ORIGIN}`, rel);
    if (absolute) {
      check(assetExistsInDist(url), `${label} asset exists in dist/`, rel);
    }
  }

  // 7. JSON-LD: at least one well-formed SoftwareApplication block on `/`
  // (additional blocks such as FAQPage are allowed), or at least one
  // well-formed block on other pages.
  const ldScripts = root.querySelectorAll('script[type="application/ld+json"]');
  if (rel === "index.html") {
    check(ldScripts.length >= 1, "at least one JSON-LD block on /", rel);
    let hasSoftwareApp = false;
    for (const s of ldScripts) {
      let parsed = null;
      try {
        parsed = JSON.parse(s.text);
      } catch {
        // surfaced by per-block parse check below
      }
      check(parsed !== null, "JSON-LD parses as JSON", rel);
      if (parsed?.["@type"] === "SoftwareApplication") hasSoftwareApp = true;
    }
    check(hasSoftwareApp, "JSON-LD SoftwareApplication block present on /", rel);
  } else {
    for (const s of ldScripts) {
      let ok = true;
      try {
        JSON.parse(s.text);
      } catch {
        ok = false;
      }
      check(ok, "JSON-LD parses as JSON", rel);
    }
  }

  // 8. Anchor integrity: every in-page #fragment has a matching id.
  const anchors = root.querySelectorAll('a[href^="#"]');
  const idSet = new Set(root.querySelectorAll("[id]").map((el) => el.getAttribute("id")));
  for (const a of anchors) {
    const href = a.getAttribute("href") ?? "";
    if (href === "#") continue; // bare `#` is a no-op, common for JS-toggled UI.
    const fragment = href.slice(1);
    check(idSet.has(fragment), `anchor #${fragment} has matching id`, rel);
  }

  // 9. Every <img> carries an alt attribute (empty string allowed for
  // decorative images; missing attribute is not).
  for (const img of root.querySelectorAll("img")) {
    const hasAlt = img.hasAttribute("alt");
    const src = img.getAttribute("src") ?? "<unknown>";
    check(hasAlt, `<img src="${src}"> has alt attribute`, rel);
  }

  // 10. Robots meta mirrors the noindex allowlist.
  const robotsMeta = root.querySelector('meta[name="robots"]');
  const robotsContent = robotsMeta?.getAttribute("content")?.toLowerCase() ?? "";
  if (NOINDEX_PAGES.has(rel)) {
    check(robotsContent.includes("noindex"), "noindex page has robots=noindex", rel);
  } else {
    check(robotsMeta === null, "indexable page has no robots meta", rel);
  }
}

function auditBuildWide() {
  // 11. Sitemap integrity.
  const sitemapPath = join(distRoot, "sitemap-0.xml");
  check(existsSync(sitemapPath), "sitemap-0.xml exists", "dist/sitemap-0.xml");
  if (existsSync(sitemapPath)) {
    const xml = readFileSync(sitemapPath, "utf8");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    check(locs.length > 0, "sitemap-0.xml lists at least one URL", "dist/sitemap-0.xml");
    for (const loc of locs) {
      // /404 must never be listed.
      const looksLike404 = loc === `${SITE_ORIGIN}/404` || loc === `${SITE_ORIGIN}/404/`;
      check(!looksLike404, `sitemap does not list /404 (found ${loc})`, "dist/sitemap-0.xml");

      // Every listed URL must resolve to a built HTML page.
      if (loc.startsWith(`${SITE_ORIGIN}/`)) {
        const pathname = loc.slice(SITE_ORIGIN.length);
        const candidates =
          pathname === "/"
            ? ["index.html"]
            : [
                `${pathname.replace(/^\//, "").replace(/\/$/, "")}/index.html`,
                `${pathname.replace(/^\//, "").replace(/\/$/, "")}.html`,
              ];
        const found = candidates.some((c) => existsSync(join(distRoot, c)));
        check(found, `sitemap URL resolves to built HTML (${loc})`, "dist/sitemap-0.xml");
      }
    }
  }

  // 12. robots.txt references the sitemap index.
  const robotsPath = join(distRoot, "robots.txt");
  check(existsSync(robotsPath), "robots.txt exists", "dist/robots.txt");
  if (existsSync(robotsPath)) {
    const txt = readFileSync(robotsPath, "utf8");
    check(
      txt.includes(`${SITE_ORIGIN}/sitemap-index.xml`),
      `robots.txt references ${SITE_ORIGIN}/sitemap-index.xml`,
      "dist/robots.txt",
    );
  }

  // 13. Required icon set: every file exists, is non-zero, and (for
  // PNGs) declares at least the expected pixel dimensions.
  for (const icon of REQUIRED_ICONS) {
    const p = join(distRoot, icon.name);
    const exists = existsSync(p);
    check(exists, `${icon.name} exists`, `dist/${icon.name}`);
    if (!exists) continue;
    const size = statSync(p).size;
    check(size > 0, `${icon.name} is non-zero bytes`, `dist/${icon.name}`);
    if (icon.name.endsWith(".png")) {
      const dims = pngDimensions(p);
      check(dims !== null, `${icon.name} is a valid PNG`, `dist/${icon.name}`);
      if (dims) {
        check(
          dims.width >= icon.width && dims.height >= icon.height,
          `${icon.name} at least ${icon.width}×${icon.height} (got ${dims.width}×${dims.height})`,
          `dist/${icon.name}`,
        );
      }
    }
  }
}

const pages = walkHtml(distRoot);
if (pages.length === 0) {
  console.error(`audit: no HTML pages found under ${distRoot}`);
  process.exit(1);
}
for (const page of pages) auditPage(page);
auditBuildWide();

console.log(`\naudit: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
