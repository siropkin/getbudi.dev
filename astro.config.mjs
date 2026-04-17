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
  integrations: [
    sitemap({
      // The 404 page is a real static output but it should never appear
      // in search results. Explicit filter here beats a separate meta
      // tag on preview deploys (Vercel sets X-Robots-Tag: noindex on
      // preview builds by default; this is the production safeguard).
      filter: (page) => !page.endsWith("/404") && !page.endsWith("/404/"),
    }),
  ],
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
