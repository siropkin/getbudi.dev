export const installCommands = {
  macos: "brew install siropkin/budi/budi && budi init",
  linux: "curl -fsSL https://getbudi.dev/install.sh | sh",
  windows: "irm https://getbudi.dev/install.ps1 | iex",
};

export const updateCommands = {
  macos: "brew upgrade budi",
  linux: "curl -fsSL https://getbudi.dev/install.sh | sh",
  windows: "irm https://getbudi.dev/install.ps1 | iex",
};

export const uninstallCommands = {
  macos: "brew uninstall budi",
  linux: "rm -f ~/.local/bin/budi ~/.local/bin/budi-daemon",
  windows: 'Remove-Item -Recurse -Force "$env:LOCALAPPDATA\\budi"',
};

export const firstRunSteps = [
  {
    n: "1",
    cmd: "budi init",
    body: "Starts the daemon on port 7878 and installs the platform-native autostart service. The hero install runs this for you — listed here so you know what just happened.",
  },
  {
    n: "2",
    cmd: "budi integrations install",
    body: "Wires the Claude Code statusline and offers the VS Code / Cursor extension if either editor is detected. Restart Claude Code afterwards so it picks up the new statusLine command.",
  },
  {
    n: "3",
    cmd: "budi doctor",
    body: 'End-to-end verifier: daemon, tailers, schema, transcript visibility, and attribution health. When "All checks passed." you are done.',
  },
  {
    n: "4",
    cmd: "budi status",
    body: "Today’s-cost snapshot: daemon state and today’s spend. For the full breakdown, use budi stats projects / branches / tickets.",
  },
];
