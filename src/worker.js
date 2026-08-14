// Language negotiation on `/`, and nothing else.
//
// WHY THERE IS NOW A `main` WHEN wrangler.jsonc SPENT A PARAGRAPH SAYING THERE
// IS NOT. That paragraph's reason still stands and is the whole design of this
// file: `_headers` applies to static assets but NOT to responses a Worker
// builds, so a script that constructs its own Response silently drops the
// security headers. The fix is not to re-attach them here — that would put the
// policy in two places, which is the failure the file was written to avoid.
//
// So this Worker never builds a response. It asks the assets layer for the one
// it would have served, and changes a single header on the way out. Everything
// in `_headers` arrives because the assets layer put it there.
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
// NO USER-AGENT CHECK, AND THAT IS THE POINT. Decision #59 exempts bots from
// the redirect, and the way to do that without going near cloaking is to key on
// the request header rather than on who is asking: a crawler that sends no
// `Accept-Language` matches nothing and falls through to the canonical locale,
// which is the outcome that decision wanted. Everyone gets the same 302; only
// the destination differs, and it differs on a header built for exactly this.

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

export default {
  async fetch(request, env) {
    const served = await env.ASSETS.fetch(request);

    // Only `/` negotiates. Every other path is an asset or one of the twenty
    // stable 301s, and both are decided without looking at the reader.
    const url = new URL(request.url);
    if (url.pathname !== "/") return served;

    const target = preferred(request.headers.get("accept-language"));

    // A response whose destination depends on a request header has to say so,
    // or a shared cache will hand one reader's answer to the next.
    const out = new Response(served.body, served);
    out.headers.set("Vary", "Accept-Language");

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
