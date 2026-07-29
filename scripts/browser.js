// Starting the browser, in one place, so the escape hatch below belongs to every
// audit rather than to whichever one someone happened to be running.
//
// Playwright downloads its own Chromium. On a machine where that download cannot
// complete, all four visual tools are simply unavailable — which is not a small
// inconvenience. The CSP defect found on 2026-07-30 was visible only to a
// browser pointed at production: curl never triggers the injection that causes
// it, the local emulator is not behind the zone, and the preview URLs a build
// uploads are on workers.dev rather than in the zone. It went unfound for as
// long as no browser could be started, and it was found within minutes of one
// being started.
//
// PLAYWRIGHT_CHANNEL names an already-installed browser to use instead of the
// downloaded one — `chrome` for Google Chrome, `msedge` for Edge. Unset, this is
// exactly `chromium.launch()`, so CI and anyone whose download worked see no
// change at all.
//
//   PLAYWRIGHT_CHANNEL=chrome BASE_URL=https://taux.io npm run contract

const { chromium } = require("playwright");

function launch(options = {}) {
  const channel = process.env.PLAYWRIGHT_CHANNEL;
  return chromium.launch(channel ? { ...options, channel } : options);
}

module.exports = { launch };
