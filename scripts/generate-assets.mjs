#!/usr/bin/env node
/**
 * One-shot generator for the binary launch assets that cannot live inside
 * an Astro build: the OG social image and the app-icon PNG sizes.
 *
 * Run with `npm run generate-assets` when the brand or copy on these assets
 * changes. The outputs are committed to `public/` so the Astro build stays
 * dependency-free at runtime.
 *
 * Why a standalone script and not the Astro pipeline:
 *   - OG images change maybe twice a year; a build-time generator would
 *     pull fonts + run resvg on every CI build for no real benefit.
 *   - `public/*.png` ships verbatim through Vercel with long-lived cache
 *     headers (see vercel.json), so committing the PNGs is the cheapest
 *     delivery path.
 *
 * Fonts are downloaded on first run and cached under `scripts/fonts/`
 * (gitignored). The script is idempotent and safe to re-run.
 */
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fontsDir = resolve(__dirname, "fonts");
const pubDir = resolve(__dirname, "..", "public");
mkdirSync(fontsDir, { recursive: true });

const FONT_SOURCES = {
  // Fontsource's jsDelivr mirror ships the exact static TTF subsets we need
  // (both OFL). The URLs are immutable, CORS-friendly, and resolve fast
  // enough that running this generator over a cold cache takes < 3s.
  "Inter-Regular.ttf":
    "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf",
  "Inter-SemiBold.ttf":
    "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf",
  "JetBrainsMono-Medium.ttf":
    "https://cdn.jsdelivr.net/fontsource/fonts/jetbrains-mono@latest/latin-500-normal.ttf",
};

async function ensureFont(name) {
  const path = resolve(fontsDir, name);
  if (!existsSync(path)) {
    const url = FONT_SOURCES[name];
    console.log(`  fetching ${name} …`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`font fetch failed: ${res.status} ${res.statusText} ${url}`);
    }
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return path;
}

function esc(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Build the OG image as raw SVG. We lay text out by hand (manual
 * `<text>` positioning) so we don't depend on a flexbox engine —
 * resvg renders the SVG straight to PNG using the three fonts we
 * download.
 */
function buildOGSvg() {
  const W = 1200;
  const H = 630;
  const headline1 = "See where your AI coding money";
  const headline2 = "actually goes.";
  const sub = "Local-first cost tracker for Claude Code, Cursor, Codex, and Copilot.";
  const sub2 = "One proxy. Real attribution. Prompts never leave your machine.";
  const install = "brew install siropkin/budi/budi && budi init";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="g1" cx="85%" cy="-5%" r="55%">
      <stop offset="0%" stop-color="#22c55e" stop-opacity="0.26"/>
      <stop offset="100%" stop-color="#0b0d10" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="-5%" cy="25%" r="55%">
      <stop offset="0%" stop-color="#6366f1" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#0b0d10" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="#0b0d10"/>
  <rect width="${W}" height="${H}" fill="url(#g1)"/>
  <rect width="${W}" height="${H}" fill="url(#g2)"/>

  <!-- Brand row -->
  <circle cx="92" cy="92" r="10" fill="#22c55e"/>
  <circle cx="92" cy="92" r="18" fill="none" stroke="#22c55e" stroke-opacity="0.35" stroke-width="2"/>
  <text x="116" y="100" font-family="Inter" font-weight="600" font-size="30" fill="#e6e8ec" letter-spacing="-0.3">budi</text>
  <text x="186" y="100" font-family="Inter" font-weight="400" font-size="22" fill="#9aa3b2">/ getbudi.dev</text>

  <!-- Headline -->
  <text x="80" y="312" font-family="Inter" font-weight="600" font-size="78" fill="#e6e8ec" letter-spacing="-1.8">${esc(headline1)}</text>
  <text x="80" y="400" font-family="Inter" font-weight="600" font-size="78" fill="#22c55e" letter-spacing="-1.8">${esc(headline2)}</text>

  <!-- Subhead -->
  <text x="80" y="460" font-family="Inter" font-weight="400" font-size="24" fill="#9aa3b2">${esc(sub)}</text>
  <text x="80" y="494" font-family="Inter" font-weight="400" font-size="24" fill="#9aa3b2">${esc(sub2)}</text>

  <!-- Install command chip -->
  <rect x="80" y="528" width="1040" height="72" rx="14" fill="#11141a" stroke="#232832"/>
  <text x="108" y="576" font-family="JetBrains Mono" font-weight="500" font-size="26" fill="#22c55e">$</text>
  <text x="136" y="576" font-family="JetBrains Mono" font-weight="500" font-size="26" fill="#e6e8ec">${esc(install)}</text>
</svg>`;
}

async function renderOG() {
  await Promise.all([
    ensureFont("Inter-Regular.ttf"),
    ensureFont("Inter-SemiBold.ttf"),
    ensureFont("JetBrainsMono-Medium.ttf"),
  ]);

  const svg = buildOGSvg();
  const resvg = new Resvg(svg, {
    fitTo: { mode: "original" },
    background: "#0b0d10",
    font: {
      fontFiles: [
        resolve(fontsDir, "Inter-Regular.ttf"),
        resolve(fontsDir, "Inter-SemiBold.ttf"),
        resolve(fontsDir, "JetBrainsMono-Medium.ttf"),
      ],
      loadSystemFonts: false,
      defaultFontFamily: "Inter",
    },
  });
  const png = resvg.render().asPng();
  writeFileSync(resolve(pubDir, "og.png"), png);
  console.log("  wrote public/og.png");
}

function renderIcons() {
  // Derive the app-icon PNG sizes from the existing favicon.svg so the
  // brand stays in one place. resvg does not need fonts for this SVG.
  const svg = readFileSync(resolve(pubDir, "favicon.svg"), "utf8");
  const sizes = [
    { name: "apple-touch-icon.png", size: 180 },
    { name: "icon-192.png", size: 192 },
    { name: "icon-512.png", size: 512 },
  ];
  for (const { name, size } of sizes) {
    const png = new Resvg(svg, {
      fitTo: { mode: "width", value: size },
      background: "#0b0d10",
    })
      .render()
      .asPng();
    writeFileSync(resolve(pubDir, name), png);
    console.log(`  wrote public/${name}`);
  }
}

console.log("Generating launch assets:");
renderIcons();
await renderOG();
console.log("Done.");
