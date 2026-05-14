// Canonical list of in-page section anchors used by the marketing site.
//
// Why centralize: the header nav (Base.astro), the mobile-nav <details>
// disclosure (#119), the section <section id="…"> tags in index.astro,
// and any cross-section links all need to agree on the same fragment
// IDs. The audit-build script catches local href/id mismatches per
// page, but only after a build — pulling the IDs from one constant
// means a typo or rename surfaces at the type level instead.
//
// Convention: each key is the section's role; the value is the literal
// fragment ID rendered into the DOM (no leading `#`). Use the helper
// `anchorHref` (or `siteAnchorHref`) when constructing `<a href>` so
// callers can't drift from the constant.

export const ANCHORS = {
  /** Skip-to-content target on <main>. */
  main: "main",
  /** Section IDs on the landing page. */
  features: "features",
  providers: "providers",
  compare: "compare",
  privacy: "privacy",
  install: "install",
  teams: "teams",
  faq: "faq",
  /** Sub-section anchors inside the landing page. */
  analytics: "analytics",
  editorExtension: "editor-extension",
} as const;

export type AnchorId = (typeof ANCHORS)[keyof typeof ANCHORS];

/** Same-page link: `#install`. */
export const anchorHref = (id: AnchorId): string => `#${id}`;

/** Cross-page link from any subpage back to `/`: `/#install`. */
export const siteAnchorHref = (id: AnchorId): string => `/#${id}`;
