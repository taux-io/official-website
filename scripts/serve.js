// `npm run serve`: wrangler dev on 127.0.0.1, port from $PORT (default 8099).
//
// 8099 is what CI's audit job and the visual tooling expect, so unset PORT must
// stay 8099. A set-but-invalid PORT is an error rather than a fallback: silently
// serving on 8099 would hit whoever else owns that port.
//
//   PORT=8393 npm run serve
//   node scripts/serve.js --print     # show the command, don't run it
//
// Runs wrangler as a direct child and forwards termination signals to it, so
// stopping this process stops wrangler (and the workerd it spawns).

const { spawn } = require("node:child_process");
const path = require("node:path");

const DEFAULT_PORT = 8099;

function resolvePort(raw) {
  if (raw === undefined) return DEFAULT_PORT;
  if (/^[0-9]+$/.test(raw)) {
    const n = Number(raw);
    if (n >= 1 && n <= 65535) return n;
  }
  throw new Error(`invalid PORT ${JSON.stringify(raw)}: expected an integer in 1-65535 (unset PORT to use ${DEFAULT_PORT})`);
}

let port;
try {
  port = resolvePort(process.env.PORT);
} catch (e) {
  console.error(`serve: ${e.message}`);
  process.exit(1);
}

const args = ["dev", "--port", String(port), "--ip", "127.0.0.1"];

if (process.argv.includes("--print")) {
  console.log(["wrangler", ...args].join(" "));
  process.exit(0);
}

const bin = path.join(__dirname, "..", "node_modules", ".bin", "wrangler");
const child = spawn(bin, args, { stdio: "inherit" });

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => child.kill(sig));
}
child.on("error", (e) => {
  console.error(`serve: cannot run wrangler (${e.message}); run npm ci first`);
  process.exit(1);
});
child.on("exit", (code, signal) => {
  if (signal) {
    process.removeAllListeners(signal);
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 1);
  }
});
