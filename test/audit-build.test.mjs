// Fixture-based tests for scripts/build/audit-build.mjs.
//
// Strategy: build a minimal but fully-valid `dist/` in a temp dir, then
// mutate one file at a time to drive each negative path. The audit
// script is invoked as a subprocess so the test pins the exact CLI
// contract `npm run build` depends on (exit code + per-check stdout
// markers).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, unlinkSync, rmSync } from "node:fs";
import { join } from "node:path";

import {
  makeTempDir,
  buildValidDist,
  writeFixtureFile,
  validIndexHtml,
  valid404Html,
  makePng,
  SITE_ORIGIN,
} from "./helpers/fixture-dist.mjs";
import { runScript } from "./helpers/run-script.mjs";

const SCRIPT = "scripts/build/audit-build.mjs";

function runAudit(distRoot) {
  return runScript(SCRIPT, [distRoot]);
}

test("valid dist passes the audit", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    buildValidDist(dir);
    const result = runAudit(dir);
    assert.equal(
      result.status,
      0,
      `expected exit 0 — stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
    assert.match(result.stdout, /audit: \d+ passed, 0 failed/);
  } finally {
    cleanup();
  }
});

test("missing dist directory exits non-zero", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    const result = runAudit(join(dir, "does-not-exist"));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /dist directory not found/);
  } finally {
    cleanup();
  }
});

test("empty dist directory exits non-zero", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    const result = runAudit(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /no HTML pages found/);
  } finally {
    cleanup();
  }
});

test("canonical href mismatch fails the audit", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    buildValidDist(dir);
    writeFixtureFile(
      join(dir, "index.html"),
      validIndexHtml({ canonical: `${SITE_ORIGIN}/wrong-path` }),
    );
    const result = runAudit(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /✗ canonical href = https:\/\/getbudi\.dev\//);
  } finally {
    cleanup();
  }
});

test("missing canonical link fails the audit", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    buildValidDist(dir);
    const html = validIndexHtml().replace(/<link rel="canonical"[^>]*>\n?/, "");
    writeFixtureFile(join(dir, "index.html"), html);
    const result = runAudit(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /✗ canonical present and unique/);
  } finally {
    cleanup();
  }
});

test("description shorter than 50 chars fails the audit", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    buildValidDist(dir);
    writeFixtureFile(join(dir, "index.html"), validIndexHtml({ description: "too short" }));
    const result = runAudit(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /✗ description length in 50\.\.200/);
  } finally {
    cleanup();
  }
});

test("missing og:image fails the audit", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    buildValidDist(dir);
    const html = validIndexHtml().replace(/<meta property="og:image" content="[^"]*">\n?/, "");
    writeFixtureFile(join(dir, "index.html"), html);
    const result = runAudit(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /✗ og:image present/);
  } finally {
    cleanup();
  }
});

test("og:image pointing at missing asset fails the audit", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    buildValidDist(dir);
    // Replace og.png with og:image pointing somewhere that does not exist.
    const html = validIndexHtml().replace(`${SITE_ORIGIN}/og.png`, `${SITE_ORIGIN}/missing-og.png`);
    writeFixtureFile(join(dir, "index.html"), html);
    const result = runAudit(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /✗ og:image asset exists in dist/);
  } finally {
    cleanup();
  }
});

test("twitter:card other than summary_large_image fails the audit", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    buildValidDist(dir);
    const html = validIndexHtml().replace(
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:card" content="summary">`,
    );
    writeFixtureFile(join(dir, "index.html"), html);
    const result = runAudit(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /✗ twitter:card = summary_large_image/);
  } finally {
    cleanup();
  }
});

test("missing SoftwareApplication JSON-LD on / fails the audit", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    buildValidDist(dir);
    writeFixtureFile(
      join(dir, "index.html"),
      validIndexHtml({
        jsonLd: [{ "@context": "https://schema.org", "@type": "WebSite" }],
      }),
    );
    const result = runAudit(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /✗ JSON-LD SoftwareApplication block present on \//);
  } finally {
    cleanup();
  }
});

test("malformed JSON-LD block fails the audit", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    buildValidDist(dir);
    const html = validIndexHtml().replace(
      /<script type="application\/ld\+json">[^<]*<\/script>/,
      `<script type="application/ld+json">{not valid json}</script>`,
    );
    writeFixtureFile(join(dir, "index.html"), html);
    const result = runAudit(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /✗ JSON-LD parses as JSON/);
  } finally {
    cleanup();
  }
});

test("anchor pointing at a non-existent id fails the audit", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    buildValidDist(dir);
    writeFixtureFile(
      join(dir, "index.html"),
      validIndexHtml({
        body: `<main id="main"><a href="#nope">broken</a></main>`,
      }),
    );
    const result = runAudit(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /✗ anchor #nope has matching id/);
  } finally {
    cleanup();
  }
});

test("img without alt fails the audit", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    buildValidDist(dir);
    writeFixtureFile(
      join(dir, "index.html"),
      validIndexHtml({
        body: `<main id="main"><img src="/og.png"></main>`,
      }),
    );
    const result = runAudit(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /✗ <img src="\/og\.png"> has alt attribute/);
  } finally {
    cleanup();
  }
});

test("indexable page with robots meta fails the audit", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    buildValidDist(dir);
    // Sneak a noindex onto / where it should not be.
    writeFixtureFile(
      join(dir, "index.html"),
      validIndexHtml({
        extraHead: `<meta name="robots" content="noindex">`,
      }),
    );
    const result = runAudit(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /✗ indexable page has no robots meta/);
  } finally {
    cleanup();
  }
});

test("404 without noindex robots meta fails the audit", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    buildValidDist(dir);
    // Overwrite 404 with a copy that lacks the robots meta.
    const html = valid404Html().replace(/<meta name="robots"[^>]*>\n?/, "");
    writeFixtureFile(join(dir, "404.html"), html);
    const result = runAudit(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /✗ noindex page has robots=noindex/);
  } finally {
    cleanup();
  }
});

test("sitemap listing /404 fails the audit", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    buildValidDist(dir);
    writeFixtureFile(
      join(dir, "sitemap-0.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        `  <url><loc>${SITE_ORIGIN}/</loc></url>\n` +
        `  <url><loc>${SITE_ORIGIN}/404</loc></url>\n` +
        `</urlset>\n`,
    );
    const result = runAudit(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /✗ sitemap does not list \/404/);
  } finally {
    cleanup();
  }
});

test("sitemap URL with no matching HTML fails the audit", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    buildValidDist(dir);
    writeFixtureFile(
      join(dir, "sitemap-0.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        `  <url><loc>${SITE_ORIGIN}/</loc></url>\n` +
        `  <url><loc>${SITE_ORIGIN}/ghost-page</loc></url>\n` +
        `</urlset>\n`,
    );
    const result = runAudit(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /✗ sitemap URL resolves to built HTML/);
  } finally {
    cleanup();
  }
});

test("missing robots.txt fails the audit", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    buildValidDist(dir);
    unlinkSync(join(dir, "robots.txt"));
    const result = runAudit(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /✗ robots\.txt exists/);
  } finally {
    cleanup();
  }
});

test("robots.txt without sitemap reference fails the audit", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    buildValidDist(dir);
    writeFileSync(join(dir, "robots.txt"), "User-agent: *\nAllow: /\n");
    const result = runAudit(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /✗ robots\.txt references/);
  } finally {
    cleanup();
  }
});

test("missing required icon fails the audit", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    buildValidDist(dir);
    unlinkSync(join(dir, "icon-192.png"));
    const result = runAudit(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /✗ icon-192\.png exists/);
  } finally {
    cleanup();
  }
});

test("undersized PNG fails the dimension check", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    buildValidDist(dir);
    // Replace og.png with a 100×100 PNG — well below 1200×630.
    writeFixtureFile(join(dir, "og.png"), makePng(100, 100));
    const result = runAudit(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /✗ og\.png at least 1200×630/);
  } finally {
    cleanup();
  }
});

test("non-PNG bytes in a .png path fail the audit", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    buildValidDist(dir);
    // Write enough bytes that the audit reaches the IHDR check.
    writeFileSync(join(dir, "icon-192.png"), Buffer.alloc(64));
    const result = runAudit(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /✗ icon-192\.png is a valid PNG/);
  } finally {
    cleanup();
  }
});

test("subdirectory pages are audited for their derived canonical", () => {
  const { dir, cleanup } = makeTempDir();
  try {
    buildValidDist(dir);
    // Add a /foo/ page. Its canonical must be https://getbudi.dev/foo/.
    writeFixtureFile(
      join(dir, "foo", "index.html"),
      validIndexHtml({ canonical: `${SITE_ORIGIN}/foo/` }),
    );
    // Add the sitemap entry too so the build-wide check stays happy.
    writeFixtureFile(
      join(dir, "sitemap-0.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        `  <url><loc>${SITE_ORIGIN}/</loc></url>\n` +
        `  <url><loc>${SITE_ORIGIN}/foo/</loc></url>\n` +
        `</urlset>\n`,
    );
    const result = runAudit(dir);
    assert.equal(result.status, 0, `expected exit 0 — stdout:\n${result.stdout}`);
  } finally {
    cleanup();
  }
});
