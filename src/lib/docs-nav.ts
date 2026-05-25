export interface DocsNavItem {
  label: string;
  href: string;
  indent?: boolean;
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
      { label: "Cursor", href: "/docs/providers/cursor/", indent: true },
      { label: "Claude Code", href: "/docs/providers/claude-code/", indent: true },
      { label: "Codex CLI", href: "/docs/providers/codex-cli/", indent: true },
      { label: "Copilot CLI", href: "/docs/providers/copilot-cli/", indent: true },
      { label: "Copilot Chat", href: "/docs/providers/copilot-chat/", indent: true },
      { label: "Commands", href: "/docs/commands/" },
    ],
  },
];
