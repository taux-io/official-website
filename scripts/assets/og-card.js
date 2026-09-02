// The share card's frame and type scale, and nothing that draws.
//
//   const { WIDTH, HEIGHT, TYPE_SCALE } = require("./og-card");
//
// WHY THESE LEFT build-og.js. Two gates need these numbers — `og scale jump`
// reads the ladder, `og geometry` reads the frame — and build-og.js is a script
// that launches Chromium. Requiring it to read a constant loaded playwright as
// a side effect: measured 104ms of that rule's 105ms. It also needed a
// `require.main === module` guard so that importing it did not rebuild 100 PNGs,
// which is the tell that a build script was being used as a data module.
//
// routes.js is the shape this follows (rule 19, `single route table`): the data
// lives in one module and the scripts read it, rather than each script carrying
// its own copy. `visual/cards.js` had already grown a second declaration of
// 1200x630 under a comment citing build-og.js's constants — two statements of
// one carrier size, and resizing the card would have left the gate asserting
// the old frame against all 100 files.

const path = require("path");

// The carrier. DESIGN.md's proportional rules — 5-9% outer margin, a dominant
// subject at 45-80% — are only measurable because this is a constant; on a page
// the denominator is whatever viewport is looking.
const WIDTH = 1200;
const HEIGHT = 630;

const OUT_DIR = path.join(__dirname, "..", "..", "static", "og");

// The card's type scale, named so something outside the renderer can read it.
//
// `kicker` is the page's `eyebrow` step. The two carry the same role — small,
// uppercase, 0.09em — and there is no reason for the card to hold a size the
// page does not. It was 17px until v5, which put the jump at 4.71x, under the
// reference set's 5-12x floor; at 12 it is 6.67x for a short title and 5.17x
// for a long one.
const TYPE_SCALE = {
  mark: 26,
  kicker: 12,
  desc: 23,
  title: { short: 80, long: 62 },
};

// Above this many characters the title drops to the smaller step. DESIGN.md
// decision #93 records the branch as a known defect rather than a design: it
// makes a card's type size depend on how long its title happens to be, which is
// why the same page's card is set at 80px in one locale and 62px in another.
const TITLE_LONG_THRESHOLD = 34;

module.exports = { WIDTH, HEIGHT, OUT_DIR, TYPE_SCALE, TITLE_LONG_THRESHOLD };
