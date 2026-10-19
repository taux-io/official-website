// Tests for scripts/serve.js, the `npm run serve` wrapper.
//
//   node --test scripts/serve.test.mjs
//
// `--print` makes the wrapper print the wrangler argv it would run and exit,
// so the port decision is observable without starting a server.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVE = path.join(path.dirname(fileURLToPath(import.meta.url)), "serve.js");

function run(port) {
  const env = { ...process.env };
  delete env.PORT;
  if (port !== undefined) env.PORT = port;
  return spawnSync(process.execPath, [SERVE, "--print"], { env, encoding: "utf8" });
}

test("PORT unset serves on 8099 (what CI's audit job expects)", () => {
  const r = run();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /--port 8099 --ip 127\.0\.0\.1/);
});

test("PORT=8393 serves on 8393 only", () => {
  const r = run("8393");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /--port 8393 --ip 127\.0\.0\.1/);
  assert.doesNotMatch(r.stdout, /8099/);
});

for (const bad of ["abc", "0", "65536", "-1", "80.5", "8393x", "", " "]) {
  test(`PORT=${JSON.stringify(bad)} fails loudly, no fallback to 8099`, () => {
    const r = run(bad);
    assert.notEqual(r.status, 0);
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /PORT/);
    assert.match(r.stderr, /1-65535/);
  });
}
