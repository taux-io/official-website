# Migration: Go server → Rust static generator

These two scripts exist to make one claim checkable: **the generated site is
byte-for-byte what the Go server produced**.

That claim is worth more than a checklist. If every byte matches, no canonical
tag, structured-data block, heading, internal link or meta description can have
changed — their union *is* the file. It is binary, complete, and needs no
judgement about which signals matter.

```
node scripts/migration/capture.js go    # against the Go server, once
npm run build:site
npm run compare
```

## What is normalised away, and why each is safe

| Rule | Reason |
|---|---|
| copyright year | Go read the clock per request; the generator bakes it at build time. Same value, different mechanism. |
| leading/trailing whitespace | Go's `{{ define }}` left a blank line ahead of the doctype. The construct is gone; whitespace before a doctype carries no meaning. |
| character reference notation | Go spells an escaped apostrophe `&#39;`, minijinja `&#x27;`. Same character. |

Every rule is a place a real regression could hide, so the list is kept short
and each entry is justified above rather than accumulated silently.

## What this does *not* cover

The comparison reads HTML. It says nothing about what is wrapped around it —
status codes, redirects, response headers — and those are exactly where the
migration went wrong twice:

- `/geo-guide` answered **308** rather than 200, because a page written to
  `geo-guide/index.html` is served at `/geo-guide/` and the bare path redirects.
  Every indexed URL would have gained a hop, and the canonical tag pointed at
  the form the host would not serve.
- Cache-Control came back as `max-age=3600, max-age=31536000` on fonts, because
  the host merges every matching rule instead of letting the most specific win.
  A browser takes the first, so the fonts self-hosted for performance would have
  been cached for an hour.

Both were found by serving the output through the real host emulator and asking
for the headers. Neither was visible in the HTML. That is why the contract test
runs against `npm run serve` and asserts header values positively.
