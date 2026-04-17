// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// Astro is intentionally configured for fully static output: no SSR, no
// per-request work. This site is a one-page marketing surface where every
// extra millisecond of TTFB undercuts the "budi is fast" message.
export default defineConfig({
  site: "https://getbudi.dev",
  output: "static",
  integrations: [sitemap()],
  vite: {
    // Tailwind v4 ships its own Vite plugin. Cast to any to bridge a Vite
    // major-version mismatch between tailwindcss/vite and astro's bundled vite.
    plugins: [/** @type {any} */ (tailwindcss())],
  },
  build: {
    inlineStylesheets: "auto",
  },
  compressHTML: true,
});
