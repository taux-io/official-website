// Unit tests for scripts/browser.js — the launch fallback, with the launcher
// injected so no browser is needed (and none is downloaded).
//
//   node --test scripts/browser.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const { launchWith } = createRequire(import.meta.url)("./browser.js");

const MISSING = new Error(
  "browserType.launch: Executable doesn't exist at /x/chromium_headless_shell-1234/chrome-headless-shell",
);

// What Playwright actually throws for a channel that is not installed.
const NO_CHANNEL = new Error(
  "browserType.launch: Chromium distribution 'chrome' is not found at /Applications/Google Chrome.app\nRun \"npx playwright install chrome\"",
);

// A fake chromium that records calls; `fail` lists the channels ("" = none)
// that throw MISSING (the channel launch throws NO_CHANNEL).
function fake(fail) {
  const calls = [];
  return {
    calls,
    launch: async (opts) => {
      calls.push(opts);
      if (fail.includes(opts.channel || ""))
        throw opts.channel ? NO_CHANNEL : MISSING;
      return { opts };
    },
  };
}
const run = async (chromium, env = {}) => {
  const notes = [];
  const browser = await launchWith(chromium, { env, log: (m) => notes.push(m) });
  return { browser, notes };
};

test("headless shell present: plain launch, no note", async () => {
  const c = fake([]);
  const { notes } = await run(c, {});
  assert.deepEqual(c.calls, [{}]);
  assert.deepEqual(notes, []);
});

test("PLAYWRIGHT_CHANNEL set: used as-is, no fallback, no note", async () => {
  const c = fake([]);
  const { notes } = await run(c, { PLAYWRIGHT_CHANNEL: "msedge" });
  assert.deepEqual(c.calls, [{ channel: "msedge" }]);
  assert.deepEqual(notes, []);
});

test("PLAYWRIGHT_CHANNEL set and failing: error propagates unchanged", async () => {
  const c = fake(["msedge"]);
  await assert.rejects(run(c, { PLAYWRIGHT_CHANNEL: "msedge" }), NO_CHANNEL);
  assert.equal(c.calls.length, 1);
});

test("headless shell missing: falls back to chrome and says so in one line", async () => {
  const c = fake([""]);
  const { browser, notes } = await run(c, {});
  assert.deepEqual(c.calls, [{}, { channel: "chrome" }]);
  assert.equal(browser.opts.channel, "chrome");
  assert.equal(notes.length, 1);
  assert.match(notes[0], /chrome/i);
  assert.doesNotMatch(notes[0], /\n/);
});

test("options are preserved through the fallback", async () => {
  const c = fake([""]);
  await launchWith(c, { env: {}, log() {}, options: { args: ["--x"] } });
  assert.deepEqual(c.calls[1], { args: ["--x"], channel: "chrome" });
});

test("neither headless shell nor Chrome: error says what to install", async () => {
  const c = fake(["", "chrome"]);
  await assert.rejects(run(c, {}), (e) => {
    assert.match(e.message, /npx playwright install chromium/);
    assert.match(e.message, /Google Chrome/);
    assert.match(e.message, /PLAYWRIGHT_CHANNEL/);
    return true;
  });
});

test("unrelated launch errors are not swallowed into a fallback", async () => {
  const boom = new Error("GPU process crashed");
  const c = {
    calls: [],
    launch: async (o) => {
      c.calls.push(o);
      throw boom;
    },
  };
  await assert.rejects(run(c, {}), boom);
  assert.equal(c.calls.length, 1);
});
