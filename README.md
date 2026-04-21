# getbudi.dev

Marketing landing page for [**budi**](https://github.com/siropkin/budi) — the open-source, local-first cost tracker for AI coding agents. Lives at [getbudi.dev](https://getbudi.dev).

This repo is the public face, not the product. The CLI / daemon lives in [`siropkin/budi`](https://github.com/siropkin/budi); the authenticated cloud dashboard at `app.getbudi.dev` lives in [`siropkin/budi-cloud`](https://github.com/siropkin/budi-cloud).

## Install budi

```bash
brew install siropkin/budi/budi && budi init && budi integrations install
```

Other install methods and the full first-run checklist live on the site.

## Stack

Astro 5 + Tailwind CSS v4, fully static output, deployed on Vercel.

## Develop

```bash
npm install
npm run dev            # http://localhost:4321
npm run build          # static build to dist/ (runs the post-build audit)
npm run check          # astro type + template check
npm run format:check   # prettier (same command CI runs)
```

Node 20.3+.

## Contributing

Canonical contributor guidance — repo layout, content principles, CI, deploy, analytics, and the boundary between this repo and the other budi repos — lives in [`SOUL.md`](./SOUL.md). Read that before opening a PR.

## License

MIT. See the [budi LICENSE](https://github.com/siropkin/budi/blob/main/LICENSE).
