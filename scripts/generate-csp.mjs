#!/usr/bin/env node
// Generate the Content-Security-Policy header for vercel.json from the
// inline <script> blocks Astro produces in dist/.
//
// The page ships a handful of inline scripts: two `application/ld+json`
// blocks (SoftwareApplication on every page, FAQPage on /), the bundled
// modules Astro hoists from CopyableCommand and OsInstallTabs, and the
// Vercel Web Analytics startup snippet. CSP enforcement requires either
// 'unsafe-inline' (which defeats the point) or a sha256 hash per block.
//
// Hashes change whenever any inline script body changes. Treating them
// as build output keeps the policy honest: edit a script → re-run
// `npm run build` → vercel.json picks up the new hashes. Vercel reads
// vercel.json after the build command, so the post-build state is what
// gets deployed.

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const distRoot = process.argv[2] ?? "dist";
const vercelPath = "vercel.json";

if (!existsSync(distRoot) || !statSync(distRoot).isDirectory()) {
  console.error(`csp: dist directory not found at ${distRoot}`);
  process.exit(1);
}
if (!existsSync(vercelPath)) {
  console.error(`csp: ${vercelPath} not found`);
  process.exit(1);
}

function walkHtml(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "_astro") continue;
      out.push(...walkHtml(full));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

// Capture every inline <script>...</script> body, regardless of type,
// so JSON-LD and module blocks both get hashed.
const SCRIPT_RE = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g;

const hashes = new Set();
const pages = walkHtml(distRoot);
if (pages.length === 0) {
  console.error(`csp: no HTML pages found under ${distRoot}`);
  process.exit(1);
}

for (const page of pages) {
  const html = readFileSync(page, "utf8");
  let m;
  while ((m = SCRIPT_RE.exec(html)) !== null) {
    const body = m[1];
    if (body.length === 0) continue; // <script src="..."> external — covered by 'self'.
    const digest = createHash("sha256").update(body).digest("base64");
    hashes.add(`'sha256-${digest}'`);
  }
}

// `frame-ancestors` is enforced by X-Frame-Options DENY too, but having
// both keeps the policy self-describing and survives a future drop of
// the legacy header.
//
// `connect-src 'self'` covers the @vercel/analytics beacon (same-origin
// /_vercel/insights/event) and the dynamically injected analytics
// script (/_vercel/insights/script.js, also same-origin).
//
// 'unsafe-inline' for styles matches the issue's suggested baseline:
// inline styles can't really do XSS, and Astro inlines small Tailwind
// blocks via `inlineStylesheets: "auto"` which would otherwise need
// per-build hashing for marginal benefit.
const scriptSrc = ["'self'", ...[...hashes].sort()].join(" ");
const policy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const vercel = JSON.parse(readFileSync(vercelPath, "utf8"));

// Scope CSP to the production host. Vercel preview deploys
// (*.vercel.app) inject the Vercel Toolbar / Comments runtime from
// https://vercel.live/_next-live/feedback/feedback.js plus inline
// bootstraps; under a strict CSP those get blocked, log console
// errors, and drop the Lighthouse Best Practices score below the gate
// even though production never sees those scripts. The toolbar is
// only injected on preview hosts, so a host-scoped CSP gives prod the
// real policy and lets preview deploys stay clean for Lighthouse.
const PROD_HOST = "getbudi.dev";
const cspEntry = vercel.headers?.find(
  (h) => h.source === "/(.*)" && h.has?.some((c) => c.type === "host" && c.value === PROD_HOST),
);
if (!cspEntry) {
  console.error(
    `csp: could not find host-scoped CSP entry (source: "/(.*)", has host=${PROD_HOST}) in ${vercelPath}`,
  );
  process.exit(1);
}

const idx = cspEntry.headers.findIndex((h) => h.key === "Content-Security-Policy");
const next = { key: "Content-Security-Policy", value: policy };
if (idx === -1) {
  cspEntry.headers.push(next);
} else {
  cspEntry.headers[idx] = next;
}

const before = readFileSync(vercelPath, "utf8");
const after = JSON.stringify(vercel, null, 2) + "\n";
if (before === after) {
  console.log(`csp: ${vercelPath} already up to date (${hashes.size} script hashes)`);
} else {
  writeFileSync(vercelPath, after);
  console.log(`csp: wrote ${vercelPath} with ${hashes.size} script hashes`);
}
