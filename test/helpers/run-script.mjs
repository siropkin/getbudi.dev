// Spawn a build script (audit-build.mjs / generate-csp.mjs) as a child
// process. Both scripts are CLIs whose contract is the (exit code,
// stdout) pair the build pipeline reads — so we test the CLI surface,
// not the script's internals.

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(import.meta.url), "..", "..", "..");

/**
 * Run a node script with the given args and capture exit code + stdout
 * + stderr. The script path is resolved relative to the repo root so
 * tests do not depend on the test runner's cwd. Pass `cwd` to run the
 * script from a different working directory (e.g. for CSP tests that
 * need a fixture vercel.json beside the dist/ tree).
 */
export function runScript(scriptPath, args = [], { cwd } = {}) {
  const full = resolve(repoRoot, scriptPath);
  const result = spawnSync(process.execPath, [full, ...args], {
    cwd: cwd ?? repoRoot,
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}
