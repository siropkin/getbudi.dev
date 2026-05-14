// Helpers for building a fixture `dist/` tree in a temp directory.
//
// The build scripts under `scripts/build/` operate on an Astro-style
// `dist/` layout. To exercise them in tests without running a full
// `astro build`, we synthesize the minimum subset of files each script
// reads (HTML pages, sitemap, robots.txt, app-icon PNGs) and then mutate
// individual files to drive each invariant under test.

import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

const SITE_ORIGIN = "https://getbudi.dev";

/**
 * Allocate a fresh temp directory and return both the absolute path and
 * a `cleanup()` function. Tests pair this with `t.after(cleanup)` so
 * fixtures never leak between runs.
 */
export function makeTempDir(prefix = "getbudi-test-") {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  const cleanup = () => rmSync(dir, { recursive: true, force: true });
  return { dir, cleanup };
}

/**
 * Write `content` to `filePath`, creating parent directories as needed.
 */
export function writeFixtureFile(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

/**
 * Minimal byte-valid PNG just for audit-build's IHDR sniffing. The
 * audit only reads the 8-byte signature and IHDR width/height (offsets
 * 16..23); it does not decode pixels or verify CRC. A 33-byte file is
 * enough to make `pngDimensions()` report the requested geometry.
 */
export function makePng(width, height) {
  const buf = Buffer.alloc(33);
  // PNG signature.
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  buf[4] = 0x0d;
  buf[5] = 0x0a;
  buf[6] = 0x1a;
  buf[7] = 0x0a;
  // IHDR chunk length = 13.
  buf.writeUInt32BE(13, 8);
  // IHDR chunk type.
  buf.write("IHDR", 12, "ascii");
  // Width / height — what the audit actually reads.
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  // bit_depth + color_type + compression + filter + interlace + (unverified) CRC.
  // Leave as zeros; audit ignores them.
  return buf;
}

/**
 * Build a "happy path" homepage HTML that satisfies every per-page
 * audit invariant. Tests start from this and mutate a single piece to
 * drive each negative case.
 */
export function validIndexHtml({
  canonical = `${SITE_ORIGIN}/`,
  description = "A long-enough description for the test fixture homepage that comfortably sits within the 50..200 character window required by the audit.",
  jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "budi",
    },
  ],
  extraHead = "",
  body = `<main id="main"><a href="#main">Skip</a></main>`,
} = {}) {
  const lines = [
    "<!DOCTYPE html>",
    '<html lang="en"><head>',
    '<meta charset="utf-8">',
    `<title>budi — fixture</title>`,
    `<link rel="canonical" href="${canonical}">`,
    `<meta name="description" content="${description}">`,
    `<meta property="og:title" content="budi — fixture">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:image" content="${SITE_ORIGIN}/og.png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="budi">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="budi — fixture">`,
    `<meta name="twitter:description" content="${description}">`,
    `<meta name="twitter:image" content="${SITE_ORIGIN}/og.png">`,
    `<meta name="twitter:image:alt" content="budi">`,
    ...jsonLd.map(
      (block) => `<script type="application/ld+json">${JSON.stringify(block)}</script>`,
    ),
    extraHead,
    "</head><body>",
    body,
    "</body></html>",
  ];
  return lines.join("\n");
}

/**
 * 404 page variant — adds the `noindex` robots meta the audit requires
 * for everything in NOINDEX_PAGES.
 */
export function valid404Html() {
  return validIndexHtml({
    canonical: `${SITE_ORIGIN}/404`,
    extraHead: `<meta name="robots" content="noindex">`,
    jsonLd: [],
  });
}

/**
 * Lay down a minimal but fully-valid `dist/` that should pass every
 * audit-build invariant. Tests mutate this tree (overwriting one file
 * or deleting one icon) to drive specific failure modes.
 */
export function buildValidDist(distRoot) {
  // Pages — `/` and `/404`. The audit walks these recursively.
  writeFixtureFile(join(distRoot, "index.html"), validIndexHtml());
  writeFixtureFile(join(distRoot, "404.html"), valid404Html());

  // Sitemap — only the indexable page. /404 is intentionally absent.
  writeFixtureFile(
    join(distRoot, "sitemap-0.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `  <url><loc>${SITE_ORIGIN}/</loc></url>\n` +
      `</urlset>\n`,
  );

  // robots.txt must reference the sitemap-index URL.
  writeFixtureFile(
    join(distRoot, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${SITE_ORIGIN}/sitemap-index.xml\n`,
  );

  // The icon set the audit enforces.
  writeFixtureFile(join(distRoot, "og.png"), makePng(1200, 630));
  writeFixtureFile(join(distRoot, "icon-192.png"), makePng(192, 192));
  writeFixtureFile(join(distRoot, "icon-512.png"), makePng(512, 512));
  writeFixtureFile(join(distRoot, "apple-touch-icon.png"), makePng(180, 180));
  writeFixtureFile(
    join(distRoot, "favicon.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>',
  );

  return distRoot;
}

export { SITE_ORIGIN };
