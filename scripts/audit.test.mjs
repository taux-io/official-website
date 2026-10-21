// Tests for scripts/audit.js, the `npm run audit` orchestrator.
//
//   node --test scripts/audit.test.mjs
//
// The seam is runAudit({ steps, startServer }): steps and the server are
// injected, so the orchestration (keep going after a failure, a dead server is
// a failure, the server is always stopped) is observable without a browser.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const { runAudit, STEPS } = createRequire(import.meta.url)("./audit.js");

function fakeServer() {
  const s = {
    baseUrl: "http://127.0.0.1:1",
    up: true,
    stops: 0,
    isAlive: async () => s.up,
    stop: async () => {
      s.stops++;
    },
  };
  return s;
}

function harness(stepDefs, server = fakeServer(), startServer) {
  const ran = [];
  const steps = stepDefs.map(([name, code, hook]) => ({
    name,
    run: async (baseUrl) => {
      ran.push(name);
      if (hook) hook(server);
      assert.equal(baseUrl, server.baseUrl);
      return code;
    },
  }));
  const lines = [];
  const opts = {
    steps,
    startServer: startServer || (async () => server),
    out: (l) => lines.push(l),
  };
  return { ran, lines, server, run: () => runAudit(opts) };
}

test("all steps green: exit 0, every step listed, server stopped", async () => {
  const h = harness([["a", 0], ["b", 0]]);
  const r = await h.run();
  assert.equal(r.exitCode, 0);
  assert.deepEqual(h.ran, ["a", "b"]);
  const text = h.lines.join("\n");
  assert.match(text, /a.*exit 0/);
  assert.match(text, /b.*exit 0/);
  assert.equal(h.server.stops, 1);
});

test("one failing step: the rest still run, exit non-zero, summary names it", async () => {
  const h = harness([["a", 0], ["b", 3], ["c", 0]]);
  const r = await h.run();
  assert.notEqual(r.exitCode, 0);
  assert.deepEqual(h.ran, ["a", "b", "c"]);
  const text = h.lines.join("\n");
  assert.match(text, /b.*exit 3/);
  assert.match(text, /FAIL.*\bb\b/);
  assert.equal(h.server.stops, 1);
});

test("server killed during a step: that step and the run fail, never pass", async () => {
  const h = harness([["a", 0], ["b", 0, (s) => (s.up = false)], ["c", 0]]);
  const r = await h.run();
  assert.notEqual(r.exitCode, 0);
  assert.match(h.lines.join("\n"), /b.*server/i);
  assert.equal(h.server.stops, 1);
});

test("server already dead before a step: that step is not trusted", async () => {
  const h = harness([["a", 0, (s) => (s.up = false)], ["c", 0]]);
  const r = await h.run();
  assert.notEqual(r.exitCode, 0);
  assert.match(h.lines.join("\n"), /c.*server/i);
  assert.equal(h.server.stops, 1);
});

test("server never comes up: fails with the reason, no step runs", async () => {
  const h = harness([["a", 0]], fakeServer(), async () => {
    throw new Error("never answered on port 1");
  });
  const r = await h.run();
  assert.notEqual(r.exitCode, 0);
  assert.deepEqual(h.ran, []);
  assert.match(h.lines.join("\n"), /never answered on port 1/);
});

test("a step that throws is a failure and the server is still stopped", async () => {
  const server = fakeServer();
  const lines = [];
  const r = await runAudit({
    steps: [
      {
        name: "boom",
        run: async () => {
          throw new Error("kaboom");
        },
      },
      { name: "after", run: async () => 0 },
    ],
    startServer: async () => server,
    out: (l) => lines.push(l),
  });
  assert.notEqual(r.exitCode, 0);
  assert.match(lines.join("\n"), /kaboom/);
  assert.match(lines.join("\n"), /after.*exit 0/);
  assert.equal(server.stops, 1);
});

test("the real step list is the CI audit job's, in order, without the network check", () => {
  assert.deepEqual(
    STEPS.map((s) => s.name),
    ["contrast", "contract", "sharks", "geometry", "cards"]
  );
});
