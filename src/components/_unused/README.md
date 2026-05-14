# `src/components/_unused/`

Components kept for reference but **not** currently imported by any page.
The leading underscore signals to readers (and to `git grep`) that these
files are intentionally excluded from the rendered site.

If a file in this directory is wired back into a page, move it out of
`_unused/` so the path matches its status. If it's no longer worth
keeping, delete it (the final-cleanup ticket is [#128](https://github.com/siropkin/getbudi.dev/issues/128)).

## Why keep anything here at all

Some assets cost real time to author (hand-tuned inline SVGs, in this
case) and could plausibly come back into the site after a copy or layout
change. Parking them under `_unused/` is cheaper than re-deriving them
from `git log` and keeps the active `src/components/` listing honest
about what actually ships.

## Current residents

- `Diagram.astro` — inline SVG of the local-first data flow as of Budi
  8.2 (agent → provider direct; daemon tails on-disk transcripts; opt-in
  cloud sync). Last referenced from `src/pages/index.astro` before the
  R1 site rewrite. Astro will not pick this up unless a template imports
  it.
