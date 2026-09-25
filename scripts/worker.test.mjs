// Unit tests for src/worker.js — the one piece of code that runs in production.
//
//   node --test scripts/worker.test.mjs
//
// `contract` exercises the Worker end to end against `wrangler dev`, which is
// the test that matters for headers. These pin the two things contract can only
// see indirectly: how a q-weighted Accept-Language resolves, and the property
// the file's own header says nothing enforced — that the Worker never builds a
// response of its own, because `_headers` does not apply to one it builds.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { preferred } from "../src/worker.js";

const SOURCE = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "worker.js"),
  "utf8"
);

test("no header, empty header and wildcard-only resolve to nothing", () => {
  assert.equal(preferred(null), null);
  assert.equal(preferred(""), null);
  assert.equal(preferred("*"), null);
});

test("each locale is reached by its language", () => {
  assert.equal(preferred("en-GB"), "/en-US");
  assert.equal(preferred("ja"), "/ja-JP");
  assert.equal(preferred("ko-KR"), "/ko-KR");
  assert.equal(preferred("zh-TW"), "/zh-Hant-TW");
  assert.equal(preferred("zh-HK"), "/zh-Hant-TW");
  assert.equal(preferred("zh"), "/zh-Hant-TW");
});

test("Simplified is matched before bare zh", () => {
  assert.equal(preferred("zh-CN"), "/zh-Hans-CN");
  assert.equal(preferred("zh-Hans-TW"), "/zh-Hans-CN");
  assert.equal(preferred("zh-SG"), "/zh-Hans-CN");
});

test("q weights decide, not header order", () => {
  assert.equal(preferred("en;q=0.5, ja;q=0.9"), "/ja-JP");
  assert.equal(preferred("fr, ko;q=0.3, en;q=0.2"), "/ko-KR");
});

test("q=0 means not acceptable", () => {
  assert.equal(preferred("ja;q=0, en;q=0.1"), "/en-US");
});

test("an unsupported language falls through to the next one", () => {
  assert.equal(preferred("de-DE, fr;q=0.9, en;q=0.8"), "/en-US");
  assert.equal(preferred("de-DE, fr;q=0.9"), null);
});

test("matching is case-insensitive", () => {
  assert.equal(preferred("ZH-cn"), "/zh-Hans-CN");
});

// Every Response the Worker constructs must wrap one the assets layer produced
// (`new Response(x.body, x)`), so the headers `_headers` put there survive. A
// response built from a literal body carries none of them.
test("the Worker never builds a response from scratch", () => {
  const code = SOURCE.replace(/\/\/.*$/gm, "");
  const built = [...code.matchAll(/new\s+Response\s*\(([^)]*)\)/g)].map((m) => m[1].trim());
  assert.ok(built.length > 0, "expected the Worker to re-wrap asset responses");
  for (const args of built) {
    assert.match(
      args,
      /^(\w+)\.body\s*,\s*\1$/,
      `new Response(${args}) does not wrap an asset response — _headers would not apply to it`
    );
  }
});
