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
// Which browser is used, in order:
//   1. PLAYWRIGHT_CHANNEL, if set — `chrome` for Google Chrome, `msedge` for
//      Edge. Used exactly as given; if it fails, that error is shown unchanged.
//   2. Playwright's own downloaded headless shell — exactly `chromium.launch()`,
//      so CI and anyone whose download worked see no change at all.
//   3. If (2) is missing ("Executable doesn't exist"), the locally installed
//      Google Chrome, with one line on stderr saying so. If Chrome is missing
//      too, the error says what to install.
//
// So on a machine without the download, no variable is needed:
//
//   BASE_URL=https://taux.io npm run contract

const { chromium } = require("playwright");

const MISSING = /Executable doesn't exist/;

async function launchWith(
  browserType,
  { env = process.env, log = console.error, options = {} } = {},
) {
  const channel = env.PLAYWRIGHT_CHANNEL;
  if (channel) return browserType.launch({ ...options, channel });
  try {
    return await browserType.launch(options);
  } catch (err) {
    if (!MISSING.test(err.message)) throw err;
    try {
      const browser = await browserType.launch({ ...options, channel: "chrome" });
      log(
        "browser: Playwright's headless shell is not installed; using local Google Chrome (channel=chrome).",
      );
      return browser;
    } catch (chromeErr) {
      if (!MISSING.test(chromeErr.message)) throw chromeErr;
      throw new Error(
        "No browser found: Playwright's headless shell is not installed and neither is Google Chrome.\n" +
          "Install one of: `npx playwright install chromium`, or Google Chrome " +
          "(https://www.google.com/chrome/); for Edge or another browser, set PLAYWRIGHT_CHANNEL=msedge.",
      );
    }
  }
}

function launch(options = {}) {
  return launchWith(chromium, { options });
}

// SwiftShader: software GL for a browser with no GPU (CI). The second flag is
// required by recent Chromium, which gates the SwiftShader fallback behind it.
// Shared by the still builder and the water audit, which must draw the same way.
const GPU_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];

module.exports = { launch, launchWith, GPU_ARGS };
