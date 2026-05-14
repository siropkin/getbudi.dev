// Fixture-based tests for scripts/build/generate-csp.mjs.
//
// The CSP generator reads dist/**/*.html, hashes every non-empty inline
// <script> body with sha256, and writes the result into the host-scoped
// Content-Security-Policy entry inside vercel.json. The test builds a
// throwaway working directory containing both, runs the script there,
// and asserts on the rewritten vercel.json + stdout.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

import { makeTempDir, writeFixtureFile } from "./helpers/fixture-dist.mjs";
import { runScript } from "./helpers/run-script.mjs";

const SCRIPT = "scripts/build/generate-csp.mjs";

function sha256Base64(body) {
  return `'sha256-${createHash("sha256").update(body).digest("base64")}'`;
}

/**
 * Minimal vercel.json with the same host-scoped CSP entry shape as the
 * real config: source `/(.*)`, has host=getbudi.dev. The generator
 * targets exactly this entry by predicate.
 */
function fixtureVercelJson({ initialPolicy = "default-src 'self'" } = {}) {
  return {
    headers: [
      {
        source: "/(.*)",
        has: [{ type: "host", value: "getbudi.dev" }],
        headers: [{ key: "Content-Security-Policy", value: initialPolicy }],
      },
    ],
  };
}

function readVercelJson(workDir) {
  return JSON.parse(readFileSync(join(workDir, "vercel.json"), "utf8"));
}

function findCspHeader(vercel) {
  const entry = vercel.headers.find(
    (h) =>
      h.source === "/(.*)" && h.has?.some((c) => c.type === "host" && c.value === "getbudi.dev"),
  );
  return entry?.headers.find((h) => h.key === "Content-Security-Policy")?.value;
}

function setupCspFixture(htmlByPath, vercel = fixtureVercelJson()) {
  const { dir, cleanup } = makeTempDir("getbudi-csp-test-");
  mkdirSync(join(dir, "dist"), { recursive: true });
  for (const [rel, html] of Object.entries(htmlByPath)) {
    writeFixtureFile(join(dir, "dist", rel), html);
  }
  writeFileSync(join(dir, "vercel.json"), JSON.stringify(vercel, null, 2) + "\n");
  return { dir, cleanup };
}

test("hashes every non-empty inline <script> body", () => {
  const ldBody = `{"@context":"https://schema.org","@type":"WebSite"}`;
  const moduleBody = `console.log("hello");`;
  const { dir, cleanup } = setupCspFixture({
    "index.html":
      `<!doctype html><html><head>` +
      `<script type="application/ld+json">${ldBody}</script>` +
      `<script type="module">${moduleBody}</script>` +
      `<script src="/_astro/app.js"></script>` +
      `</head><body></body></html>`,
  });
  try {
    const result = runScript(SCRIPT, ["dist"], { cwd: dir });
    assert.equal(result.status, 0, `expected exit 0 — stderr:\n${result.stderr}`);
    const csp = findCspHeader(readVercelJson(dir));
    assert.ok(csp, "CSP header should exist");
    assert.ok(
      csp.includes(sha256Base64(ldBody)),
      `CSP should hash the JSON-LD body — got:\n${csp}`,
    );
    assert.ok(
      csp.includes(sha256Base64(moduleBody)),
      `CSP should hash the module body — got:\n${csp}`,
    );
    // External <script src> bodies are empty — not hashed, covered by 'self'.
    assert.match(csp, /script-src 'self' /);
  } finally {
    cleanup();
  }
});

test("CSP includes the baseline directives", () => {
  const { dir, cleanup } = setupCspFixture({
    "index.html":
      `<!doctype html><html><head>` + `<script>const x=1;</script>` + `</head><body></body></html>`,
  });
  try {
    const result = runScript(SCRIPT, ["dist"], { cwd: dir });
    assert.equal(result.status, 0);
    const csp = findCspHeader(readVercelJson(dir));
    for (const directive of [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'none'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "manifest-src 'self'",
      "upgrade-insecure-requests",
    ]) {
      assert.ok(csp.includes(directive), `CSP missing: ${directive}`);
    }
  } finally {
    cleanup();
  }
});

test("re-running on unchanged dist is a no-op", () => {
  const { dir, cleanup } = setupCspFixture({
    "index.html":
      `<!doctype html><html><head>` + `<script>const x=1;</script>` + `</head><body></body></html>`,
  });
  try {
    const first = runScript(SCRIPT, ["dist"], { cwd: dir });
    assert.equal(first.status, 0);
    const before = readFileSync(join(dir, "vercel.json"), "utf8");
    const second = runScript(SCRIPT, ["dist"], { cwd: dir });
    assert.equal(second.status, 0);
    assert.match(second.stdout, /already up to date/);
    const after = readFileSync(join(dir, "vercel.json"), "utf8");
    assert.equal(after, before, "vercel.json should be byte-stable on no-op");
  } finally {
    cleanup();
  }
});

test("hashes are deterministic across runs and sorted", () => {
  // Two scripts whose hashes are known to sort in a specific order.
  // Order of insertion in the HTML is intentionally reversed so we can
  // confirm the generator sorts hashes rather than emitting source order.
  const a = `console.log("A");`;
  const b = `console.log("B");`;
  const { dir, cleanup } = setupCspFixture({
    "index.html":
      `<!doctype html><html><head>` +
      `<script>${b}</script>` +
      `<script>${a}</script>` +
      `</head><body></body></html>`,
  });
  try {
    const result = runScript(SCRIPT, ["dist"], { cwd: dir });
    assert.equal(result.status, 0);
    const csp = findCspHeader(readVercelJson(dir));
    const hashA = sha256Base64(a);
    const hashB = sha256Base64(b);
    const idxA = csp.indexOf(hashA);
    const idxB = csp.indexOf(hashB);
    assert.ok(idxA >= 0 && idxB >= 0);
    const sortedExpected = [hashA, hashB].sort();
    const first = sortedExpected[0] === hashA ? idxA : idxB;
    const second = sortedExpected[1] === hashA ? idxA : idxB;
    assert.ok(first < second, "hashes should appear in sorted order");
  } finally {
    cleanup();
  }
});

test("identical inline scripts across pages produce a single hash", () => {
  const body = `console.log("dup");`;
  const html =
    `<!doctype html><html><head>` + `<script>${body}</script>` + `</head><body></body></html>`;
  const { dir, cleanup } = setupCspFixture({
    "index.html": html,
    "other/index.html": html,
  });
  try {
    const result = runScript(SCRIPT, ["dist"], { cwd: dir });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /1 script hash/);
    const csp = findCspHeader(readVercelJson(dir));
    const hash = sha256Base64(body);
    const first = csp.indexOf(hash);
    const second = csp.indexOf(hash, first + 1);
    assert.notEqual(first, -1);
    assert.equal(second, -1, "duplicate hashes should be de-duplicated");
  } finally {
    cleanup();
  }
});

test("inserts the CSP header when the entry has no CSP yet", () => {
  const vercel = {
    headers: [
      {
        source: "/(.*)",
        has: [{ type: "host", value: "getbudi.dev" }],
        headers: [{ key: "X-Other", value: "x" }],
      },
    ],
  };
  const { dir, cleanup } = setupCspFixture(
    {
      "index.html":
        `<!doctype html><html><head>` +
        `<script>const x=1;</script>` +
        `</head><body></body></html>`,
    },
    vercel,
  );
  try {
    const result = runScript(SCRIPT, ["dist"], { cwd: dir });
    assert.equal(result.status, 0);
    const csp = findCspHeader(readVercelJson(dir));
    assert.ok(csp.startsWith("default-src 'self'"));
  } finally {
    cleanup();
  }
});

test("missing host-scoped CSP entry in vercel.json exits non-zero", () => {
  const vercel = {
    headers: [
      // Same source, but the host predicate points elsewhere — the
      // generator should refuse to scribble on the wrong entry.
      {
        source: "/(.*)",
        has: [{ type: "host", value: "other.example" }],
        headers: [{ key: "Content-Security-Policy", value: "x" }],
      },
    ],
  };
  const { dir, cleanup } = setupCspFixture(
    {
      "index.html":
        `<!doctype html><html><head>` +
        `<script>const x=1;</script>` +
        `</head><body></body></html>`,
    },
    vercel,
  );
  try {
    const result = runScript(SCRIPT, ["dist"], { cwd: dir });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /could not find host-scoped CSP entry/);
  } finally {
    cleanup();
  }
});

test("missing vercel.json exits non-zero", () => {
  const { dir, cleanup } = makeTempDir("getbudi-csp-test-");
  try {
    mkdirSync(join(dir, "dist"), { recursive: true });
    writeFixtureFile(
      join(dir, "dist", "index.html"),
      `<!doctype html><html><head><script>const x=1;</script></head><body></body></html>`,
    );
    const result = runScript(SCRIPT, ["dist"], { cwd: dir });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /vercel\.json not found/);
  } finally {
    cleanup();
  }
});

test("missing dist directory exits non-zero", () => {
  const { dir, cleanup } = makeTempDir("getbudi-csp-test-");
  try {
    writeFileSync(join(dir, "vercel.json"), JSON.stringify(fixtureVercelJson(), null, 2));
    const result = runScript(SCRIPT, ["dist"], { cwd: dir });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /dist directory not found/);
  } finally {
    cleanup();
  }
});

test("empty dist directory exits non-zero", () => {
  const { dir, cleanup } = makeTempDir("getbudi-csp-test-");
  try {
    mkdirSync(join(dir, "dist"), { recursive: true });
    writeFileSync(join(dir, "vercel.json"), JSON.stringify(fixtureVercelJson(), null, 2));
    const result = runScript(SCRIPT, ["dist"], { cwd: dir });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /no HTML pages found/);
  } finally {
    cleanup();
  }
});
