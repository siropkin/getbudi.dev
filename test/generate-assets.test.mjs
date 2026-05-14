// Smoke tests for scripts/generate/generate-assets.mjs.
//
// generate-assets is a manual one-shot (not chained from CI builds), so
// these tests target the **invariants** the audit relies on: every
// icon-set PNG renders to a non-zero file at the right minimum
// dimensions, and the OG SVG contains the brand copy that ships on
// social cards.
//
// The full OG render path also depends on Inter / JetBrains Mono TTFs
// the script lazily downloads from jsDelivr — we only exercise that
// path when those fonts are already cached locally (so CI without
// network access does not spuriously fail). The icon path is fully
// offline.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { buildOGSvg, renderIcons, renderOG } from "../scripts/generate/generate-assets.mjs";
import { makeTempDir, writeFixtureFile } from "./helpers/fixture-dist.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const FIXTURE_FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#0b0d10"/>
  <circle cx="50" cy="50" r="30" fill="#22c55e"/>
</svg>`;

/**
 * Sniff a PNG's IHDR for width/height — same approach the audit script
 * uses. Avoids pulling in an image decoder just to verify rendered
 * geometry.
 */
function pngDims(filePath) {
  const buf = readFileSync(filePath);
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
    return null;
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test("buildOGSvg returns the OG card with brand + install copy", () => {
  const svg = buildOGSvg();
  assert.match(svg, /^<\?xml/);
  assert.match(svg, /<svg /);
  assert.match(svg, /<\/svg>$/);
  assert.match(svg, /1200/);
  assert.match(svg, /630/);
  // Brand row and install command must appear — these are the headline
  // assertions the social preview ships with.
  assert.ok(svg.includes("budi"));
  assert.ok(
    svg.includes("brew install siropkin/budi/budi &amp;&amp; budi init"),
    "OG SVG should contain the canonical install command (HTML-escaped)",
  );
});

test("renderIcons writes 180×180, 192×192, 512×512 PNGs to pubDir", () => {
  const { dir, cleanup } = makeTempDir("getbudi-assets-test-");
  try {
    writeFixtureFile(join(dir, "favicon.svg"), FIXTURE_FAVICON);

    renderIcons({ pubDir: dir });

    const cases = [
      { name: "apple-touch-icon.png", size: 180 },
      { name: "icon-192.png", size: 192 },
      { name: "icon-512.png", size: 512 },
    ];
    for (const { name, size } of cases) {
      const p = join(dir, name);
      assert.ok(existsSync(p), `${name} should exist`);
      assert.ok(statSync(p).size > 0, `${name} should be non-empty`);
      const dims = pngDims(p);
      assert.ok(dims, `${name} should be a valid PNG`);
      assert.equal(dims.width, size, `${name} width`);
      assert.equal(dims.height, size, `${name} height`);
    }
  } finally {
    cleanup();
  }
});

test("renderIcons fails clearly when favicon.svg is missing", () => {
  const { dir, cleanup } = makeTempDir("getbudi-assets-test-");
  try {
    assert.throws(() => renderIcons({ pubDir: dir }), /ENOENT|favicon\.svg/);
  } finally {
    cleanup();
  }
});

// Opportunistic OG render test: only runs when the contributor (or a
// prior dev/CI run) has already cached the fonts the script needs.
// Skipping when offline keeps CI deterministic without giving up the
// coverage when fonts are around.
const cachedFontsDir = resolve(repoRoot, "scripts/generate/fonts");
const cachedFonts = ["Inter-Regular.ttf", "Inter-SemiBold.ttf", "JetBrainsMono-Medium.ttf"].every(
  (f) => existsSync(join(cachedFontsDir, f)),
);

test(
  "renderOG produces a 1200×630 PNG when fonts are cached",
  { skip: cachedFonts ? false : "OG fonts not cached locally — skipping" },
  async () => {
    const { dir, cleanup } = makeTempDir("getbudi-assets-test-");
    try {
      await renderOG({ pubDir: dir, fontsDir: cachedFontsDir });
      const p = join(dir, "og.png");
      assert.ok(existsSync(p), "og.png should exist");
      assert.ok(statSync(p).size > 0, "og.png should be non-empty");
      const dims = pngDims(p);
      assert.ok(dims, "og.png should be a valid PNG");
      assert.equal(dims.width, 1200);
      assert.equal(dims.height, 630);
    } finally {
      cleanup();
    }
  },
);
