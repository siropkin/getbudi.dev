# SOUL.md

Marketing landing page for **budi** — the open-source local-first cost tracker for AI coding agents. Lives at [getbudi.dev](https://getbudi.dev). The product itself lives in [`siropkin/budi`](https://github.com/siropkin/budi); the cloud dashboard (different subdomain: `app.getbudi.dev`) lives in [`siropkin/budi-cloud`](https://github.com/siropkin/budi-cloud).

This repo is the public face, not the product. Keep it small, fast, and static-friendly.

## Product boundaries

| Domain                     | Repo                                                                    | What lives there                                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `getbudi.dev`              | **this repo** (`siropkin/getbudi.dev`)                                  | Marketing site: hero, features, local-first story, install flow, opt-in cloud CTA                                                         |
| `app.getbudi.dev`          | [`siropkin/budi-cloud`](https://github.com/siropkin/budi-cloud)         | Authenticated cloud dashboard (Next.js + Supabase)                                                                                        |
| Open-source CLI / daemon   | [`siropkin/budi`](https://github.com/siropkin/budi)                     | Rust workspace: transcript-tailing daemon, CLI, core business logic                                                                       |
| Cursor / VS Code extension | [`siropkin/budi-cursor`](https://github.com/siropkin/budi-cursor)       | TypeScript extension targeting VS Code and Cursor (one VSIX, host-aware scope)                                                            |
| JetBrains plugin           | [`siropkin/budi-jetbrains`](https://github.com/siropkin/budi-jetbrains) | Kotlin sibling plugin for IntelliJ-platform IDEs — status-bar widget published to the JetBrains Marketplace Beta channel (`0.0.1-beta.x`) |
| Homebrew tap               | [`siropkin/homebrew-budi`](https://github.com/siropkin/homebrew-budi)   | `brew install siropkin/budi/budi` formula                                                                                                 |

Do **not** mix cloud dashboard code, product features, or anything that touches user data into this repo. This is a static marketing surface only.

## Stack

Chosen in [#2](https://github.com/siropkin/getbudi.dev/issues/2) (Astro 5 at the time, upgraded in-place to Astro 6 — same static-first contract): **Astro 6 + Tailwind CSS v4**, fully static output.

- Astro is static-first: the only JS that ships is what a component explicitly opts into (here, a small clipboard handler on `CopyableCommand`). This matches the "a marketing site that takes 4 seconds to render is not a good ad" rule below.
- Tailwind v4 is configured CSS-first in `src/styles/global.css` via `@theme` — no `tailwind.config.js`, no PostCSS pipeline. Theme tokens (`--color-*`, `--font-*`) auto-generate matching utilities like `bg-surface-2`, `text-fg-muted`, `border-accent`. Avoid arbitrary `[--var]` syntax in templates — in v4 it does not wrap in `var()` and silently breaks.
- No React/Vue/Svelte runtime on the critical path. If a section ever needs interactivity beyond trivial vanilla JS, add a single island rather than a whole framework.

## Project layout

```
src/
  layouts/Base.astro         # <html>, head, header (with mobile-nav <details> disclosure for the sections hidden below the sm: breakpoint), footer, skip link, OG/Twitter meta, JSON-LD seam (via <JsonLd />), icons, Vercel Web Analytics
  components/
    CopyableCommand.astro    # one-click-copy install block (hero + compact variants)
    OsInstallTabs.astro      # macOS / Linux / Windows install tabs; SSR default macOS, upgrades to the visitor's OS via a tiny inline script. Wraps CopyableCommand
    EditorInstallCards.astro # VS Code / Cursor / JetBrains install cards (logo + name → marketplace link → command — simplified in #121)
    GitHubIcon.astro         # shared GitHub mark inline SVG — used by Base.astro (footer) and index.astro (hero CTA)
    JsonLd.astro             # escapes and emits a single <script type="application/ld+json"> block — used by Base.astro (SoftwareApplication) and index.astro (FAQPage)
  lib/
    anchors.ts               # single source of truth for in-page section anchor IDs — imported by Base.astro (header nav, mobile-nav disclosure #119) and index.astro (section ids + cross-section links) so the audit-build invariant (#8 "every <a href='#X'> has a matching id") cannot drift via grep
  pages/
    index.astro              # landing page: hero → features → providers → compare → privacy → install → teams → FAQ (see "Pages" below for what each section ships)
    404.astro                # static "not found" page, noindex, linked back to /
  styles/global.css          # Tailwind v4 import + @theme tokens + base layer
public/
  favicon.svg                # SVG favicon, source of truth for icon generation
  apple-touch-icon.png       # 180×180 (generated from favicon.svg)
  icon-192.png, icon-512.png # PWA-size icons (generated from favicon.svg)
  og.png                     # 1200×630 social preview (generated, see scripts/generate/)
  robots.txt                 # allow-all + sitemap pointer
  .well-known/security.txt   # RFC 9116 contact + policy pointer (auto-served from public/)
scripts/
  build/                     # chained by `npm run build` after `astro build`; non-zero exit blocks the deploy
    audit-build.mjs          # post-build SEO / anchor / icon audit, runs after every `astro build`
    generate-csp.mjs         # post-build CSP generator: hashes inline <script> blocks in dist/ and writes the Content-Security-Policy header into vercel.json
  generate/                  # manual one-shot generators; NOT chained from build, NOT invoked by CI
    generate-assets.mjs      # PNG/OG generator (resvg + cached fonts)
    fonts/                   # downloaded on first run and cached here (gitignored); Inter + JetBrains Mono TTFs used by the OG generator
test/                        # `node --test test/*.test.mjs` — zero-dep unit tests for the build scripts
  audit-build.test.mjs       # fixture-based negative tests for every audit invariant
  generate-csp.test.mjs      # CSP hash extraction + vercel.json rewrite tests
  generate-assets.test.mjs   # icon renderer smoke test + OG SVG content assertions
  helpers/                   # fixture builders (temp dist, minimal PNGs) and subprocess runner
astro.config.mjs             # sitemap (404 filtered) + tailwindcss vite plugin + static output
vercel.json                  # static output, security headers (HSTS + CSP + frame/perm/referrer), HTML short-TTL, long-lived /_astro + image caches
lychee.toml                  # external-link health-check config (CI only)
lighthouserc.{desktop,mobile}.json  # Lighthouse CI budgets enforced against Vercel preview deploys
```

## Build & dev

```bash
npm install
npm run dev              # local dev server at http://localhost:4321
npm run build            # astro build → scripts/build/audit-build.mjs → scripts/build/generate-csp.mjs
npm run preview          # serve dist/ locally
npm run check            # astro check (TS + template diagnostics)
npm run lint             # eslint . (unused imports, dead code, stray console.log)
npm run format           # prettier --write .
npm run format:check     # prettier --check . (what CI runs)
npm test                 # unit tests for the build scripts (node --test, zero deps)
npm run audit            # re-run the post-build audit against an existing dist/
npm run csp              # re-run the CSP hash generator against an existing dist/
npm run generate-assets  # regenerate public/og.png + icon PNGs (see scripts/generate/generate-assets.mjs)
```

Node 22.12+ (Astro 6 minimum; CI pins `node-version: 22`). CI and Vercel both use the `npm run build` target, so both gating scripts (`audit-build.mjs`, `generate-csp.mjs`) run on every deploy.

Scripts are grouped by **when they run**: `scripts/build/` is everything `npm run build` chains after `astro build` (gates the deploy on non-zero exit); `scripts/generate/` is manual one-shots that are _not_ invoked by CI. Each file carries a header comment documenting when it runs, what it produces, its exit-code contract, and how to reproduce a failure locally. Start there when triaging a red build:

- `scripts/build/audit-build.mjs` — post-build SEO / structured-data / anchor / image / sitemap / icon audit. Enumerates 13 invariants in its header (per-page checks #1–10, build-wide checks #11–13).
- `scripts/build/generate-csp.mjs` — post-build inline-script hashing into `vercel.json`'s `Content-Security-Policy` header.
- `scripts/generate/generate-assets.mjs` — manual one-shot OG + app-icon PNG generator. Not chained from `build` and not invoked by CI.

## Content principles

The site should read the way the Reddit posts read — first-person, specific, honest about what budi is and isn't. Not marketing-agency copy.

- **Tone**: plain, technical, first-person where appropriate. No "revolutionize", no "seamless", no "empower".
- **Numbers**: use real numbers from real usage where possible (e.g. "136K messages, $6,154 in a month, 5,508 Haiku calls I never asked for").
- **Privacy**: lead with it. Prompts, code, file paths, and email addresses never leave the machine. Only opt-in numeric aggregates go to the cloud.
- **Install**: the primary CTA is always `brew install siropkin/budi/budi && budi init`. Install is one command. Say so.
- **No dark patterns**: no cookie walls beyond what's strictly required, no email-gated downloads, no "request a demo" when a binary is one command away.

## Pages

Intentionally a single marketing page plus a 404 — deep docs, changelog, and pricing stay out of this repo.

- `/` — section order (matches the in-source `{/* N. NAME */}` comments and the header nav anchors):
  1. **Hero** — tagline, `OsInstallTabs` install command (macOS / Linux / Windows), GitHub / For teams / Compare nav row, and a `budi stats project` terminal shot. Mobile/tablet (`< lg`) reorders to terminal-first, then install + nav (#100).
  2. **Features** (`#features`) — 4 feature cards, a paired Cursor / VS Code status-bar mock figure, and a `budi sessions <id>` terminal shot.
  3. **Providers** (`#providers`) — provider coverage matrix inside a `<details open>` (opened by default since #118) with a Copilot Chat cost-accuracy sub-state breakdown card.
  4. **Compare** (`#compare`) — honest "why not just X?" alternative table; the Budi row is highlighted.
  5. **Privacy** (`#privacy`) — three-column "never leaves / can optionally leave / how to enable" contract, plus the `#analytics` disclosure anchor linked from the footer.
  6. **Install** (`#install`) — second `OsInstallTabs`, 4-step after-install verifier (`budi init` / `budi integrations install` / `budi doctor` / `budi status`), and the `#editor-extension` picker rendered by `EditorInstallCards` (logo + name → marketplace link → command — simplified in #121). A `<details>` block exposes `Other install methods` (bundled VSIX, manual VSIX in VS Code / Cursor, daemon-from-source).
  7. **For teams** (`#teams`) — compact callout linking to `app.getbudi.dev`.
  8. **FAQ** (`#faq`) — five expandable Q&A items (first one open by default); the FAQ JSON-LD is emitted from `index.astro` via `<JsonLd />` for `FAQPage` rich results.
- Header nav (in `Base.astro`) keeps Install always visible; Compare / Privacy collapse below `sm:`, Providers / For teams / FAQ collapse below `md:`. A `<details>` "Sections" disclosure surfaces the hidden anchors on mobile (#119).
- `/404` — static "not found", `noindex`, linked back to `/`. Excluded from `sitemap-index.xml` by `astro.config.mjs`.

Deep reference links out to `siropkin/budi` (README, releases) or `app.getbudi.dev`. No `/docs`, `/pricing`, or `/changelog` page is planned — adding one re-opens the docs-drift problem we deliberately avoid by keeping a single surface.

## Deploy

Deployment target: **Vercel**, auto-deploy from `main` (per [ADR-0087 §3](https://github.com/siropkin/budi/blob/main/docs/adr/0087-cloud-infrastructure-and-deployment.md)). `vercel.json` pins `framework: "astro"`, output dir `dist`, and sets security + cache headers. Domain `getbudi.dev` is separate from `app.getbudi.dev` (which serves `budi-cloud`) — do not share edge config, cookies, or analytics scopes between them.

## CI

Two GitHub Actions workflows in `.github/workflows/` gate every PR:

- `ci.yml` — on every PR and push to `main`. Five jobs run in parallel against a fresh `node_modules` so a red signal surfaces fast: `format` (`npm run format:check`), `lint` (`npm run lint` — ESLint flat config covering Astro + TS, catches unused imports / dead code / stray `console.log`), `typecheck` (`astro check`), `test` (`npm test`), and `build` (`npm run build`, which chains `astro build` → `scripts/build/audit-build.mjs` → `scripts/build/generate-csp.mjs`). A sixth `link-check` job needs `build` and runs [lychee](https://lychee.cli.rs/) against the built `dist/` using `lychee.toml` to flag broken outbound links. Internal anchor + SEO + image invariants are the audit script's job; lychee is for external URLs only. When CI fails on the build step, read the script header comment in `scripts/build/<file>.mjs` for the exit-code contract and the local repro recipe.
- Dependency hygiene: `.github/dependabot.yml` opens grouped monthly PRs for npm and `github-actions`. Minor/patch bumps land as a single PR per ecosystem; majors come through individually so each gets review.
- Pre-commit hint (opt-in, no enforced hook): run `npm run format:check && npm run lint && npm run check` before pushing — these three are the gates that catch the most "the only thing red is whitespace" surprises on PR.
- `lighthouse.yml` — on non-draft PRs from the same repo only (fork PRs skip because they can't read the Vercel bypass secret). Resolves the Vercel preview URL from the Deployments API, runs Lighthouse CI desktop + mobile against it using `lighthouserc.{desktop,mobile}.json`, and upserts a single sticky PR comment with the scores. The gate is median-of-3 ≥ 0.95 on performance, accessibility, and best-practices. SEO is collected and surfaced in the comment but intentionally not asserted — Vercel preview deploys ship `x-robots-tag: noindex`, which caps the SEO score below the gate regardless of real SEO quality. Static SEO invariants are enforced by `scripts/build/audit-build.mjs` on every PR instead.

## SEO and social

- `og.png` (1200×630) and the app-icon PNGs are generated from `scripts/generate/generate-assets.mjs` using resvg + cached TTF fonts. They are committed to `public/` so the Astro build pipeline does not need a font download on every CI run. Regenerate with `npm run generate-assets` only when the brand/copy on those assets changes.
- `Base.astro` ships the full OG/Twitter card set, canonical URL, theme-color, and a JSON-LD `SoftwareApplication` block. The `noindex` prop on `Base.astro` is the seam for per-page robots hints (used by `404.astro`).
- The sitemap is generated by `@astrojs/sitemap` with the 404 page explicitly filtered out. `robots.txt` is allow-all and points at `/sitemap-index.xml`.

## Analytics

Vercel Web Analytics is wired in `Base.astro` via `@vercel/analytics/astro` and counts anonymous page views only: cookieless, IP hashed daily, no prompts, no code, no session replay, no cross-site tracking. The `#analytics` anchor on `/` (inside the privacy section) discloses this in plain English and is linked from the footer.

The privacy pitch (ADR-0083 §5/§7) is the product, so anything stricter than the above stays off this repo forever: no Google Analytics, no session replay, no fingerprinting, no script that sets third-party cookies. Swapping to a different privacy-respecting backend (Plausible, self-hosted Umami) is a drop-in replacement for the `<Analytics />` component — keep the footer disclosure in sync if that happens.

## Code organization

A few deliberate choices that come up often enough to be worth writing down (see [#123](https://github.com/siropkin/getbudi.dev/issues/123)):

- **`pages/index.astro` stays as one file.** It's long (~940 lines) but the data for each section (`features`, `providers`, `alternatives`, `faqs`, …) is defined immediately above its markup in the same file. Extracting each section into its own `*.astro` component would either fragment that data across multiple files or force a shared module just to pass props around — neither of which beats the "one file, one diff, one search" cost. The in-source `{/* N. NAME */}` comments are the table of contents.
- **Section anchor IDs live in `src/lib/anchors.ts`.** The header nav (`Base.astro`), the mobile-nav `<details>` disclosure (#119), the `<section id="…">` tags in `index.astro`, and every cross-section `<a href="#…">` all import from that single constant. The audit-build script's anchor-integrity check (invariant #8) is a runtime backstop, not the primary defense — drift fails at type-check now.
- **No `_unused/` graveyard.** Components that no template imports get deleted in the same PR that orphans them (resolved in [#128](https://github.com/siropkin/getbudi.dev/issues/128)). `git log` is the archive — re-deriving a hand-tuned SVG from a past revision beats carrying it as dark matter that the next sweep has to re-evaluate.
- **`scripts/` is grouped by when it runs.** `scripts/build/` is chained by `npm run build` and gates the deploy; `scripts/generate/` is manual one-shots. Each file's header explains its exit-code contract and local-repro recipe — start there when CI is red.

## Dev notes

- This repo should **not** import from `budi-cloud` or `budi`. Any shared assets (logo, brand colors) should live here and be copied to other repos rather than imported — these sites ship independently.
- Visitor-facing copy does **not** link into `siropkin/budi`'s ADR tree or `docs/` files. Contributors still reason in ADRs, but the public site reads as plain English: restate the behavior in visitor-friendly terms and keep it aligned with the current product. Docs drift is still the enemy — just solved by rewording the one surface that shipped, not by pointing marketing visitors at a decision record.
- Images should be optimized (WebP/AVIF where possible) and served with cache-friendly headers.
- Keep the page JS-light. A marketing site that takes 4 seconds to render is not a good ad for a tool that brags about being fast.
