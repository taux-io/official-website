// `npm run audit`: the browser checks of CI's `audit` job, in one command, with
// one exit code.
//
//   npm run audit
//
// It starts its own server (scripts/serve.js) on a free port the OS hands out,
// so a preview on 8099 is neither used nor disturbed, waits until it answers,
// then runs contrast, contract, water, geometry and cards in that order. A
// failing step does not stop the rest; the summary lists every step and the
// command exits non-zero if any failed. A server that never comes up, or dies
// at any point, is a failure: it is checked before and after every step, and a
// step that exited 0 against a server that died is not a pass. The server is
// stopped on success, failure and SIGINT/SIGTERM, by killing only the process
// group it was started in.
//
// check:entity:links is left out: it reaches the public internet.
//
// runAudit takes the steps and the server starter as arguments so the
// orchestration is testable (scripts/audit.test.mjs) without a browser.

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const READY_TIMEOUT_MS = 90_000;

function scriptStep(name, file) {
  return {
    name,
    run: (baseUrl, track) =>
      new Promise((resolve) => {
        const child = spawn(process.execPath, [path.join(ROOT, file)], {
          cwd: ROOT,
          env: { ...process.env, BASE_URL: baseUrl },
          stdio: "inherit",
        });
        if (track) track(child);
        child.on("error", () => resolve(127));
        child.on("exit", (code, signal) => resolve(code ?? (signal ? 128 : 1)));
      }),
  };
}

const STEPS = [
  scriptStep("contrast", "scripts/visual/contrast.js"),
  scriptStep("contract", "scripts/visual/contract.js"),
  scriptStep("water", "scripts/visual/water.js"),
  scriptStep("geometry", "scripts/visual/geometry.js"),
  scriptStep("cards", "scripts/visual/cards.js"),
];

// The server startServer is bringing up, so a signal during startup can stop it.
let starting = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function answers(baseUrl) {
  try {
    const res = await fetch(baseUrl + "/", { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

function groupAlive(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function startServer() {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const logPath = path.join(os.tmpdir(), `taux-audit-serve-${process.pid}.log`);
  const log = fs.openSync(logPath, "w");
  // detached: the server leads its own process group, so stop() can take down
  // wrangler and the workerd it spawns without touching anything else.
  const child = spawn(process.execPath, [path.join(ROOT, "scripts", "serve.js")], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", log, log],
    detached: true,
  });
  fs.closeSync(log);
  let exited = false;
  let spawnError = null;
  child.on("exit", () => (exited = true));
  child.on("error", (e) => {
    exited = true;
    spawnError = e;
  });

  const server = {
    baseUrl,
    logPath,
    isAlive: async () => !exited && (await answers(baseUrl)),
    stop: async () => {
      if (!groupAlive(child.pid)) return;
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {}
      for (let i = 0; i < 50 && groupAlive(child.pid); i++) await sleep(100);
      if (groupAlive(child.pid)) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {}
        for (let i = 0; i < 30 && groupAlive(child.pid); i++) await sleep(100);
      }
    },
  };

  starting = server; // visible to the signal handler while we wait for it
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (exited) {
      await server.stop();
      throw new Error(
        `the server exited before answering on port ${port}` +
          (spawnError ? ` (${spawnError.message})` : "") +
          `; its output is in ${logPath}`
      );
    }
    if (await answers(baseUrl)) return server;
    await sleep(500);
  }
  await server.stop();
  throw new Error(
    `the server never answered on port ${port} within ${READY_TIMEOUT_MS / 1000}s; its output is in ${logPath}`
  );
}

async function runAudit({ steps = STEPS, startServer: start = startServer, out = console.log, track } = {}) {
  const results = [];
  let server = null;
  try {
    try {
      server = await start();
    } catch (e) {
      out(`audit: server did not start: ${e.message}`);
      return { exitCode: 1, results };
    }
    out(`audit: server up at ${server.baseUrl}`);

    for (const step of steps) {
      out(`\n=== ${step.name} ===`);
      const result = { name: step.name, code: null, note: "" };
      if (!(await server.isAlive())) {
        result.note = "server was not running before the step; step not run";
        result.code = 1;
        results.push(result);
        continue;
      }
      try {
        result.code = await step.run(server.baseUrl, track);
      } catch (e) {
        result.code = 1;
        result.note = `step threw: ${e && e.message ? e.message : e}`;
      }
      if (!(await server.isAlive())) {
        result.note = (result.note ? result.note + "; " : "") + "server died during or after the step";
        if (result.code === 0) result.code = 1;
      }
      results.push(result);
    }
  } finally {
    if (server) {
      try {
        await server.stop();
      } catch (e) {
        out(`audit: failed to stop the server: ${e.message}`);
      }
    }
  }

  out("\naudit summary");
  for (const r of results) {
    const mark = r.code === 0 ? "ok  " : "FAIL";
    out(`  ${mark} ${r.name.padEnd(10)} exit ${r.code}${r.note ? `  (${r.note})` : ""}`);
  }
  const failed = results.filter((r) => r.code !== 0).map((r) => r.name);
  if (failed.length) out(`audit: FAILED: ${failed.join(", ")}`);
  else out("audit: all steps passed");
  return { exitCode: failed.length ? 1 : 0, results };
}

module.exports = { runAudit, STEPS, startServer };

if (require.main === module) {
  let step = null;
  let stopping = false;
  const onSignal = (sig, code) => async () => {
    if (stopping) return;
    stopping = true;
    console.error(`\naudit: ${sig}, stopping`);
    if (step && step.exitCode === null) step.kill("SIGTERM");
    if (starting) await starting.stop().catch(() => {});
    process.exit(code);
  };
  process.on("SIGINT", onSignal("SIGINT", 130));
  process.on("SIGTERM", onSignal("SIGTERM", 143));
  process.on("SIGHUP", onSignal("SIGHUP", 129));
  runAudit({
    track: (child) => {
      step = child;
    },
  }).then(
    (r) => process.exit(r.exitCode),
    (e) => {
      console.error(`audit: ${e.stack || e}`);
      process.exit(1);
    }
  );
}
