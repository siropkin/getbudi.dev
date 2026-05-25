export interface DocsNavItem {
  label: string;
  href: string;
}

export interface DocsNavGroup {
  title: string;
  items: DocsNavItem[];
}

export const DOCS_NAV: DocsNavGroup[] = [
  {
    title: "Overview",
    items: [{ label: "Introduction", href: "/docs/" }],
  },
  {
    title: "Guides",
    items: [
      { label: "Getting started", href: "/docs/getting-started/" },
      { label: "Providers", href: "/docs/providers/" },
      { label: "Commands", href: "/docs/commands/" },
    ],
  },
];
