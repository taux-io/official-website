// Language negotiation on `/`, and nothing else.
//
// WHY THERE IS NOW A `main` WHEN wrangler.jsonc SPENT A PARAGRAPH SAYING THERE
// IS NOT. That paragraph's reason still stands and is the whole design of this
// file: `_headers` applies to static assets but NOT to responses a Worker
// builds, so a script that constructs its own Response silently drops the
// security headers. The fix is not to re-attach them here — that would put the
// policy in two places, which is the failure the file was written to avoid.
//
// So this Worker never builds a response. It asks the assets layer for one —
// either the one it would have served for this request, or the one it serves at
// `/zh-Hant-TW` — and changes headers on the way out. Everything in `_headers`
// arrives because the assets layer put it there.
//
// ⚠️ NOTHING CHECKS THAT THE NEXT PERSON KEEPS THIS PROPERTY. There is no rule
// that fails on a `new Response("…")` in this file; the discipline is the two
// paragraphs above and the fact that `run_worker_first` is one path long. This
// is written out rather than assumed, because this repo's own argument is that
// a rule nothing checks is not a rule (decision #63).
//
// WHAT THIS BUYS OVER A ZONE REDIRECT RULE, which was the original plan:
//
//   - The rule is in the repository and in review, instead of in a dashboard
//     nobody can diff. NOTES.md already records that the zone settings violate
//     this project's own preference; this is one fewer of them.
//   - `contract` can assert it against `wrangler dev` on a laptop. The zone
//     version was only observable against production, so it could not be
//     checked before shipping.
//   - `q=` weights are honoured. Redirect Rules cannot read
//     `http.request.accepted_languages` (Transform Rules only), so that plan
//     was reduced to prefix-matching the raw header — right for ordinary
//     browsers, wrong for anything that sends its preferences out of order.
//
// THE USER-AGENT CHECK IS DECISION #59, AND IT IS NOT CLOAKING.
//
// #59 draws the line in one sentence: "送給 bot 的位元組必須和送給正典 locale
// 使用者的相同，差別只有跳不跳。依 User-Agent 給不同內容是 cloaking；依
// User-Agent 決定跳不跳不是。" That is what the code below does — a crawler on
// `/` is handed the `/zh-Hant-TW` response, byte for byte the one a reader who
// followed the 302 would receive, with a 200 instead of a redirect.
//
// THIS FILE ONCE CLAIMED THE OPPOSITE, in a paragraph headed "NO USER-AGENT
// CHECK, AND THAT IS THE POINT". Its argument was that a crawler sending no
// `Accept-Language` falls through to the canonical locale anyway, so keying on
// the request header achieves what #59 wanted. It does not: the crawler still
// got a 302, and #200's acceptance condition is a **200** at `/`, the site's
// highest-value URL. The argument was a different, easier condition wearing the
// original's name — and `contract` had been edited to describe that one too.

// The published locales, most specific pattern first. Anything not matched here
// falls through to whatever `_redirects` says, which is the canonical locale.
//
// zh is split on script rather than on region: a reader asking for zh-SG wants
// Simplified, a reader asking for zh-HK wants Traditional, and neither of those
// regions has a locale of its own here.
const MATCHERS = [
  [/^zh-(hans|cn|sg|my)\b/, "/zh-Hans-CN"],
  [/^zh\b/, "/zh-Hant-TW"], // zh-TW, zh-HK, zh-MO, bare zh
  [/^ja\b/, "/ja-JP"],
  [/^ko\b/, "/ko-KR"],
  [/^en\b/, "/en-US"],
];

// The canonical locale. `/` has no content of its own; this is where both the
// redirect and the bot exemption point.
const CANONICAL = "/zh-Hant-TW";

// THE CRAWLERS THAT GET THE EXEMPTION, NAMED ONE BY ONE.
//
// WHY THESE. Four search engines that index this site's market (Google, Bing,
// DuckDuckGo, Yahoo/Slurp), two that index the regions the other locales are
// written for (Baidu for zh-Hans-CN, Yandex), Apple's for Siri and Spotlight,
// and the three answer engines this site's whole GEO argument is aimed at
// (GPTBot, ClaudeBot, PerplexityBot). Every one of them is a documented,
// self-identifying token published by its operator.
//
// WHY NOT WIDER. A loose pattern is the dangerous direction, not a narrow one.
// Matching a bare `bot`/`spider`/`crawler` would catch strings that appear in
// ordinary product names and in preview fetchers that are standing in for a
// person, and a reader who is served a 200 at `/` never reaches their own
// language — a silent, per-user-agent failure that nothing here would surface.
//
// WHAT MISSING ONE COSTS, WHICH IS BOUNDED. An unlisted crawler gets the same
// 302 every reader gets: to its own `Accept-Language` if it sends one, to the
// canonical locale if it does not. A 302 is temporary and uncacheable as a
// permanent fact, the destination carries a self-referential canonical and the
// full hreflang set, and `x-default` still points back at `/`. So the failure
// mode is "one crawler follows one hop", not "a locale disappears from an
// index" — which is why this list is allowed to be short and explicit rather
// than clever. Add a token when a crawler matters; do not add a wildcard.
const CRAWLERS =
  /\b(?:googlebot|bingbot|duckduckbot|baiduspider|yandexbot|slurp|applebot|gptbot|claudebot|perplexitybot)\b/i;

// Accept-Language, parsed properly rather than prefix-matched.
//
// `zh-TW;q=0.1, en;q=0.9` means English. A prefix match on the raw header says
// Chinese, because Chinese is written first. Browsers do send their first
// choice first, so the cheap version is usually right — but "usually" is a
// strange thing to accept when the parsing is six lines.
export function preferred(header) {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => /^q=([\d.]+)$/.exec(p.trim())).find(Boolean);
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q[1]) : 1 };
    })
    // `*` means "anything", which is not a preference for any locale here.
    .filter((l) => l.tag && l.tag !== "*" && l.q > 0)
    // Stable within equal q, so the order the client wrote survives.
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    for (const [pattern, target] of MATCHERS) if (pattern.test(tag)) return target;
  }
  return null;
}

// A response whose destination depends on a request header has to say so, or a
// shared cache will hand one reader's answer to the next. Both headers are
// listed on BOTH branches, including the one that did not read User-Agent to
// reach its answer: a cache stores what a URL returned, not which branch
// produced it, so a 302 filed without `User-Agent` would be replayed to the
// next crawler that asked.
//
// ⚠️ WHAT ACTUALLY STOPS THE REPLAY TODAY IS NOT THIS HEADER, and the paragraph
// above read as though it were. Measured: the 302 carries no freshness and 302
// is not on RFC 9111 §15.1's heuristically-cacheable list, so a conforming
// shared cache cannot store it at all; the crawler's 200 carries
// `max-age=0, must-revalidate`, so it is stale on arrival; and Cloudflare does
// not cache extensionless HTML by default. `Vary` is correct and free, and it
// is the thing that would matter if any of those three changed — a zone Cache
// Rule with "Cache Everything" is one click away from making the 302 storable.
// It is a seatbelt, not the floor.
const VARY = "Accept-Language, User-Agent";

// Adds to whatever `Vary` the response already carries instead of replacing it.
//
// Nothing upstream sets one today — verified against the assets layer, which
// answers `Accept-Encoding: gzip, br` with a `Content-Encoding` and no `Vary` —
// so `set` and this are equivalent right now. They stop being equivalent the
// moment `_headers` or the assets layer grows one, and at that point `set`
// would drop it silently, which is the failure mode this file is otherwise
// built to avoid.
const addVary = (response) => {
  const existing = response.headers.get("Vary");
  const merged = new Set(
    (existing ? `${existing}, ${VARY}` : VARY).split(",").map((v) => v.trim()).filter(Boolean)
  );
  response.headers.set("Vary", [...merged].join(", "));
};

export default {
  async fetch(request, env) {
    // Only `/` negotiates. Every other path is an asset or one of the twenty
    // stable 301s, and both are decided without looking at the reader.
    const url = new URL(request.url);
    if (url.pathname !== "/") return env.ASSETS.fetch(request);

    // THE BOT EXEMPTION (decision #59, acceptance condition in issue #200).
    //
    // Not a second copy of the page, and not a hand-built response: the assets
    // layer is asked for `/zh-Hant-TW` and its answer is passed through, so the
    // body is the canonical locale's file byte for byte and every header in
    // `_headers` arrives because the assets layer put it there — the same
    // property the rest of this file is built around.
    //
    // The query string is not carried across. On the 302 below it has to be,
    // because a Location is where it would otherwise be lost; a 200 has no
    // Location, and the assets layer serves the same file either way.
    if (CRAWLERS.test(request.headers.get("user-agent") || "")) {
      const page = await env.ASSETS.fetch(new Request(new URL(CANONICAL, url), request));
      const exempt = new Response(page.body, page);
      addVary(exempt);
      return exempt;
    }

    const served = await env.ASSETS.fetch(request);
    const target = preferred(request.headers.get("accept-language"));

    const out = new Response(served.body, served);
    addVary(out);

    // THE QUERY STRING COMES ALONG, BECAUSE THE FALLTHROUGH ALREADY DOES.
    //
    // `_redirects` preserves it, so `/?utm_source=x` with no language
    // preference arrives at `/zh-Hant-TW?utm_source=x`. A hand-built Location
    // dropped it, which meant campaign attribution survived for readers who
    // matched no locale and vanished for everyone who matched one — the
    // difference invisible in aggregate and impossible to explain afterwards.
    //
    // Read off the request rather than off the served Location, because the
    // point is to match what the reader typed, not what the assets layer
    // decided to echo.
    if (target) out.headers.set("Location", target + url.search);
    return out;
  },
};
