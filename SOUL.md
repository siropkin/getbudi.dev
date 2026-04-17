# SOUL.md

Marketing landing page for **budi** — the open-source local-first cost tracker for AI coding agents. Lives at [getbudi.dev](https://getbudi.dev). The product itself lives in [`siropkin/budi`](https://github.com/siropkin/budi); the cloud dashboard (different subdomain: `app.getbudi.dev`) lives in [`siropkin/budi-cloud`](https://github.com/siropkin/budi-cloud).

This repo is the public face, not the product. Keep it small, fast, and static-friendly.

## Product boundaries

| Domain | Repo | What lives there |
|--------|------|-----------------|
| `getbudi.dev` | **this repo** (`siropkin/getbudi.dev`) | Marketing site: hero, features, pricing, docs-lite, install instructions |
| `app.getbudi.dev` | [`siropkin/budi-cloud`](https://github.com/siropkin/budi-cloud) | Authenticated cloud dashboard (Next.js + Supabase) |
| Open-source CLI / daemon | [`siropkin/budi`](https://github.com/siropkin/budi) | Rust workspace: daemon, CLI, proxy, core business logic |
| Cursor / VS Code extension | [`siropkin/budi-cursor`](https://github.com/siropkin/budi-cursor) | TypeScript VS Code extension |
| Homebrew tap | [`siropkin/homebrew-budi`](https://github.com/siropkin/homebrew-budi) | `brew install siropkin/budi/budi` formula |

Do **not** mix cloud dashboard code, product features, or anything that touches user data into this repo. This is a static marketing surface only.

## Stack

Chosen in [#2](https://github.com/siropkin/getbudi.dev/issues/2): **Astro 5 + Tailwind CSS v4**, fully static output.

- Astro is static-first: the only JS that ships is what a component explicitly opts into (here, a small clipboard handler on `CopyableCommand`). This matches the "a marketing site that takes 4 seconds to render is not a good ad" rule below.
- Tailwind v4 is configured CSS-first in `src/styles/global.css` via `@theme` — no `tailwind.config.js`, no PostCSS pipeline. Theme tokens (`--color-*`, `--font-*`) auto-generate matching utilities like `bg-surface-2`, `text-fg-muted`, `border-accent`. Avoid arbitrary `[--var]` syntax in templates — in v4 it does not wrap in `var()` and silently breaks.
- No React/Vue/Svelte runtime on the critical path. If a section ever needs interactivity beyond trivial vanilla JS, add a single island rather than a whole framework.

## Project layout

```
src/
  layouts/Base.astro         # <html>, head, header, footer, skip link, OG/Twitter meta, JSON-LD, icons
  components/
    CopyableCommand.astro    # one-click-copy install block (hero + compact)
    Diagram.astro            # inline SVG: agent → proxy → provider
  pages/
    index.astro              # landing page: hero → problem → features → compare → local-first → privacy → agents → install (+ after-install) → for teams
    404.astro                # static "not found" page, noindex, linked back to /
  styles/global.css          # Tailwind v4 import + @theme tokens + base layer
public/
  favicon.svg                # SVG favicon, source of truth for icon generation
  apple-touch-icon.png       # 180×180 (generated from favicon.svg, see scripts/)
  icon-192.png, icon-512.png # PWA-size icons (generated from favicon.svg)
  og.png                     # 1200×630 social preview (generated, see scripts/)
  robots.txt                 # allow-all + sitemap pointer
scripts/
  generate-assets.mjs        # one-shot PNG/OG generator (resvg + cached fonts)
astro.config.mjs             # sitemap (404 filtered) + tailwindcss vite plugin
vercel.json                  # static output, security, HTML short-TTL, long-lived /_astro + image caches
```

## Build & dev

```bash
npm install
npm run dev              # local dev server at http://localhost:4321
npm run build            # static build output to dist/
npm run preview          # serve dist/ locally
npm run check            # astro check (TS + template diagnostics)
npm run generate-assets  # regenerate public/og.png + icon PNGs (see scripts/generate-assets.mjs)
```

Node 20.3+ (Astro 5 minimum). CI and Vercel both use the `npm run build` target.

## Content principles

The site should read the way the Reddit posts read — first-person, specific, honest about what budi is and isn't. Not marketing-agency copy.

- **Tone**: plain, technical, first-person where appropriate. No "revolutionize", no "seamless", no "empower".
- **Numbers**: use real numbers from real usage where possible (e.g. "136K messages, $6,154 in a month, 5,508 Haiku calls I never asked for").
- **Privacy**: lead with it. Prompts, code, file paths, and email addresses never leave the machine. Only opt-in numeric aggregates go to the cloud.
- **Install**: the primary CTA is always `brew install siropkin/budi/budi && budi init`. Install is one command. Say so.
- **No dark patterns**: no cookie walls beyond what's strictly required, no email-gated downloads, no "request a demo" when a binary is one command away.

## Pages (planned)

- `/` — hero, 3-5 core features, install command, a live sample of `budi stats` output, link to GitHub
- `/docs` — lightweight quickstart; deep docs stay in the main repo's README and ADRs
- `/privacy` — the privacy contract from [ADR-0083](https://github.com/siropkin/budi/blob/main/docs/adr/0083-cloud-ingest-identity-and-privacy-contract.md), written in plain English
- `/pricing` — only if there's a paid tier; until then, omit
- `/changelog` — mirror of the main repo's `CHANGELOG.md` or a link to GitHub releases

## Deploy

Deployment target: **Vercel**, auto-deploy from `main` (per [ADR-0087 §3](https://github.com/siropkin/budi/blob/main/docs/adr/0087-cloud-infrastructure-and-deployment.md)). `vercel.json` pins `framework: "astro"`, output dir `dist`, and sets security + cache headers. Domain `getbudi.dev` is separate from `app.getbudi.dev` (which serves `budi-cloud`) — do not share edge config, cookies, or analytics scopes between them.

## SEO and social

- `og.png` (1200×630) and the app-icon PNGs are generated from `scripts/generate-assets.mjs` using resvg + cached TTF fonts. They are committed to `public/` so the Astro build pipeline does not need a font download on every CI run. Regenerate with `npm run generate-assets` only when the brand/copy on those assets changes.
- `Base.astro` ships the full OG/Twitter card set, canonical URL, theme-color, and a JSON-LD `SoftwareApplication` block. The `noindex` prop on `Base.astro` is the seam for per-page robots hints (used by `404.astro`).
- The sitemap is generated by `@astrojs/sitemap` with the 404 page explicitly filtered out. `robots.txt` is allow-all and points at `/sitemap-index.xml`.

## Analytics (deferred)

No analytics in v1. The privacy pitch (ADR-0083 §5/§7) is the product, so the site cannot ship Google Analytics, session replay, fingerprinting, or any script that sets third-party cookies. When a privacy-respecting option is added (Plausible or self-hosted Umami), wire it in `Base.astro`, disclose the collection in the footer, and keep it off preview/staging deploys.

## Dev notes

- This repo should **not** import from `budi-cloud` or `budi`. Any shared assets (logo, brand colors) should live here and be copied to other repos rather than imported — these sites ship independently.
- If any content on the site references a feature, link to the ADR or the code in the main repo rather than restating the behavior here. Docs drift is the enemy.
- Images should be optimized (WebP/AVIF where possible) and served with cache-friendly headers.
- Keep the page JS-light. A marketing site that takes 4 seconds to render is not a good ad for a tool that brags about being fast.
