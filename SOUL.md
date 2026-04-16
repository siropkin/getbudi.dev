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

## Stack (TBD)

Stack is not yet chosen. Pick one of the following and fill in the Build section below:

- **Astro** — preferred for a marketing site (static-first, easy to keep fast)
- **Next.js** — matches `budi-cloud` if reuse of components is desired
- **Plain HTML + Tailwind** — if the site stays small

When a stack is picked, update this file with concrete build / dev commands.

## Build & dev

```bash
# TODO: fill in once stack is chosen. Examples:
# npm install
# npm run dev       # local dev server
# npm run build     # static build output
# npm run preview   # serve built output locally
```

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

Deployment target: Vercel or Cloudflare Pages (TBD). Domain `getbudi.dev` is owned and DNS is separate from `app.getbudi.dev` (which serves `budi-cloud`).

## Dev notes

- This repo should **not** import from `budi-cloud` or `budi`. Any shared assets (logo, brand colors) should live here and be copied to other repos rather than imported — these sites ship independently.
- If any content on the site references a feature, link to the ADR or the code in the main repo rather than restating the behavior here. Docs drift is the enemy.
- Images should be optimized (WebP/AVIF where possible) and served with cache-friendly headers.
- Keep the page JS-light. A marketing site that takes 4 seconds to render is not a good ad for a tool that brags about being fast.
