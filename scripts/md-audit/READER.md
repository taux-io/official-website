# The reader's recipe

What a reader is given, what it must answer, and what it is allowed to call
fine. Issue 272 produced this; issue 273 runs it over all hundred pages.

A reader is an assertion made of prose. Every assertion in `check:md` was proved
red before it was kept, because an assertion that has never failed describes
nothing — and prose cannot be read to find out what it checks, so it
needs the same treatment more, not less. The red proof for this recipe is at the
bottom, with the classes it caught and the ones it did not.

## Two passes, because one is provably not enough

**Pass A — fidelity.** Does the Markdown say what the page says? Input is the
pairs `scripts/md-audit` produced, minus the ones the whitelist claims.

**Pass B — readability.** Does the Markdown read correctly on its own? Input is
every heading in the twin. No HTML.

Pass B is not a nicety. THE DEFECT THAT STARTED THIS WHOLE LINE OF WORK IS
INVISIBLE TO PASS A, and that is measured, not argued: apply the `unseparate`
defect to `/zh-Hant-TW` — glue the two halves of its H1 together, exactly as the
build shipped for weeks — and the aligner reports **4 pairs, 4 identical, 0
needing judgement**. The broken twin matches the page perfectly, because the
page has no separator either. A hundred and sixty headings shipped that way and
Pass A would hand a reader nothing at all.

Of the 1300 headings in the current build, **1140 are identical between the page
and its twin**, so Pass A never shows them to anyone. That is the hole Pass B
covers.

## Pass A — what you are looking at

Each item is one pair. Answer one question:

> Does the Markdown block say the same thing as the HTML block?

Not "is it formatted the same" — Markdown is a different notation and will look
different. The question is whether a person reading only the Markdown would come
away with what the page said.

### Legal differences — do not report these

These are transformations the converter performs deliberately. They are listed
in `whitelist.js` with the issue that introduced each one, and the tool already
removes them before you see anything. They are repeated here so you can
recognise a variant that slipped through rather than treating it as a finding:

1. **Markdown notation itself.** `#` for headings, `**` for bold, `` ` `` for
   code, `[text](url)` for links, `|` for tables, `>` for quotes. A backslash
   before punctuation (`1\.`) is Markdown escaping, not a typo.
2. **The heading part separator.** A heading can be built from two parts — two
   language halves, or a section number drawn as a circle and a title. CSS lays
   them out as two lines or a badge; Markdown has neither, so the generator
   writes ` — ` between them. The HTML carries no separator, so every such
   heading differs by exactly that string. `## 01 — Tool Wrapper` and
   `## 提示詞注入 — Prompt Injection` are both correct output, not findings.
   (Issues 270, 278, 281.)
3. **Decorative chips dropped.** `class="tag"` draws a rounded pill above a
   heading. In Markdown there is no shape, so it would land as a bare line
   reading like a sentence the page is making. The generator drops it, so the
   page has a block the twin does not. (Issue 270.)
4. **Links rewritten absolute.** `/zh-Hant-TW/geo-guide` and `#speed` become
   `https://taux.io/...`. The link TEXT must be unchanged; only the destination
   is rewritten, and it must point at the same page.
5. **Decorative SVG, scripts and styles absent.** They carry no text a reader
   is shown.

### What IS a finding

- Text on the page that is missing from the twin.
- Text in the twin that is not on the page.
- The same words in a different order.
- A number, name, date or identifier that changed.
- A term the page marked as code or emphasis arriving as plain prose, where
  that changes what it means (`linear_create_issue` as running text).
- A table row with fewer values than the page shows.
- A link whose destination is not the page's destination — a different host, a
  different path, or an invented one.

## Pass B — reading the twin alone

You are given every heading in one Markdown twin, in order, with its line
number, from `node scripts/md-audit --route <path> --headings`. No HTML.

**Sharding.** There are 1300 headings across the hundred pages; the largest page
has 49 and the median has 12. One reader per page is the unit — a heading only
makes sense beside the headings around it, and a page is small enough that
nothing needs splitting further.

Answer one question per heading:

> Read on its own, is this a heading — or two things run together?

The failure to look for: a heading built from an English half and a
locale-language half, joined with nothing between them, so the join reads as a
single broken phrase (`Empowering Business with AI AI を、企業が本当に使える力に`
— the reader's eye stops at `with AI AI`). Correct output separates the halves
with ` — `.

Also report a heading that is empty, that is only punctuation, that repeats the
heading above it verbatim, or that is a fragment of a sentence continuing from
somewhere else.

Do not report a heading merely for being bilingual, for containing an English
term inside the local language, or for being long.

## Output format

**Every page opens with its own line, before any items** — including a page with
no items at all. A reader that reports only problems is indistinguishable from a
reader that did not read: the two produce identical output when there is nothing
to find, and one of them is lying.

```
PAGE <page>.md  <n> pairs, <n> legal by whitelist, <n> judged, <n> findings
```

⚠️ THE FIRST VERSION OF THIS SECTION SAID "every page gets a record" AND THEN
SPECIFIED A FORMAT THAT COULD NOT PRODUCE ONE. It was "one line per item", and
after the whitelist most pages have zero items — ninety of the hundred do — so
ninety pages would have produced nothing at all. The per-page line above is the
record; the items below it are the findings.

Then one line per item:

```
<page>.md:<line>  OK
<page>.md:<line>  FINDING  <one sentence: what is wrong>
                  PAGE:  <the HTML text, quoted>
                  TWIN:  <the Markdown text, quoted>
                  KIND:  conversion | source | whitelist-gap
                  GATE:  mechanical | judgement
```

Quote the text. A finding without the two quoted sides cannot be checked by
anyone who was not the reader.

**KIND** — which of three things this is. Issue 273 sorts every finding into
these and cannot do it after the fact:

- `conversion` — the twin misrepresents the page. This is what the audit is for.
- `source` — the page itself is wrong and the twin copied it faithfully. Record
  it and move on; fixing the page is out of scope, and a twin that reproduces a
  bad page is doing its job.
- `whitelist-gap` — a difference that IS deliberate but no rule in
  `whitelist.js` claims. Not a defect in the twin; a defect in the whitelist.

**GATE** — could a program decide this, or does it need a reader?

- `mechanical` — a rule could be written: an exact string, a count, a missing
  element. These become new assertions in `check:md`, which is where the
  findings of this audit are supposed to end up.
- `judgement` — it took reading to see. It stays a reader's job.

## Red proof

`inject.js` breaks a twin on purpose in six ways. The recipe was run against
each. Results are recorded in `RED-PROOF.md` beside this file — which class was
caught, by which pass, and any class that was not.
