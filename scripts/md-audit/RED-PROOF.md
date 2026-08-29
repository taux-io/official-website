# Red proof for the reader's recipe

Every assertion in `check:md` was proved red before it was kept, because an
assertion that has never failed describes nothing. A reader is an assertion made
of prose, and it cannot be read to find out what it checks — so it needs this
more, not less.

`inject.js` breaks a twin on purpose in six ways. A reader was run on each,
**without being told whether anything had been injected** — a reader told to
expect a defect finds one either way, and the result would say nothing.

## Result

| class | what it does | caught | by |
|---|---|---|---|
| `swallow` | a whole block disappears from the twin | yes | Pass A |
| `reorder` | two blocks swap places | yes | Pass A |
| `dropcell` | a table row loses a cell | yes | Pass A |
| `destress` | inline emphasis and code markers stripped | yes, **after a tool fix** | Pass A |
| `relink` | a link keeps its text, points elsewhere | yes, **after a tool fix** | Pass A |
| `unseparate` | the halves of a bilingual heading run together | yes | Pass B |
| *(control)* | a clean page, both passes | 0 false positives | — |

The control was `/zh-Hant-TW/agent-dev-workflow`: 593 pairs and 49 headings, the
largest page in the build, with nothing injected. Both passes returned clean. On
two other pages a reader was handed the pull-quote re-blocking that `geo-guide`
genuinely has and called it OK three separate times, correctly — the quote body
and its attribution are both present, in order, unchanged.

## The two that failed the first round, and why the reader was not at fault

`destress` and `relink` were injected, changed the file, and **never reached the
reader's input at all**. Verified by grep: `example.invalid` appeared 0 times in
the reader's table, and the flattened `**優勢：**` block appeared 0 times.

The cause was in the tool, not the recipe. The normalisation that makes an HTML
block and a Markdown block comparable — strip the markup, keep the words —
discards exactly the two things those defects live in:

    <a href="/x">text</a>   and   [text](https://taux.io/x)   ->  "text"
    <strong>優勢：</strong>  and   **優勢：**                   ->  "優勢："

Both sides normalised to the same string, so the aligner called each pair a
perfect match and showed it to nobody. **A reader that is not shown a defect has
not missed it**, and a proof that stopped at "2 of 6 not caught" would have
blamed the recipe for the tool's blind spot and shipped both holes.

The fix: link destinations and marked spans travel with the block, inside the
alignment key but outside the displayed text. When the two sides' words are
identical the table prints the links or marks — because the first attempt handed
a reader two character-for-character identical lines and expected it to find the
redirected link.

Re-run after the fix: both caught. The `relink` reader quoted both link lists and
cited the whitelist's own condition that an absolutised link must still point at
the same page. The `destress` reader noticed that the same converter preserved
emphasis in another block on the same page, so the missing mark was a drop rather
than a policy.

**Cost of the fix: none.** 38 pairs across the hundred pages needed a reader's
judgement before adding links and marks to the key, and 38 after. Two defect
classes covered, zero extra noise. Getting there took four rounds of tuning —
`<pre><code>` counted as an inline mark, the two sides splitting adjacent marks
differently, and a helper that stripped `_` and turned `<user_input>` into
`<userinput>` on the five pages that teach it. That last one is the SECOND time
an underscore rule has corrupted an identifier in `blocks.js`; the warning about
the first is eight lines above where it happened.

## What review found afterwards, and what it says about this document

A two-axis review of this work found two things that change what the table above
means.

**The whitelist was silencing a whole class of real loss.** Its chip rule
matched any html-only `text` block on a `div` or `span` — tag name alone,
because the blocks did not carry their class. 395 blocks in this build match
that shape, the longest 473 characters. Deleting a cited study from one twin and
re-running gave `89 identical, 1 legal by whitelist, 0 needing judgement`: a
`swallow` defect, of the exact class this document reports as caught, made
invisible before any reader saw it. Rules are now narrowed by a class token and
each declares the count it matches, so a rule that widens shows as a number that
moved.

**`swallow` could not be injected on 85 of the 100 routes**, including the
control page — the injector required exactly one blank line after the paragraph.
So the first round tested the most basic defect class only where it happened to
apply, and this document reported six of six regardless. Fixed; it now applies on
89 of 100, and re-running it on the control page surfaces the pair. The reader's
catch of `swallow` stands from the first round on `/ja-JP/threat-landscape`; what
was re-verified here is the injector, not the reader.

**Four numbers in the first version of this file and its neighbours were wrong**
— reproduced by a reviewer as 75 rather than 123, 356 rather than 41, five pages
rather than fifteen, and "sorting whole runs did not help" when it cost exactly
one pair. They were remembered from tuning rounds rather than measured, and
nothing in the repository can re-derive them. They have been removed rather than
corrected: a number that cannot be re-derived does not belong in a comment, and
this was the eighth wrong number on this line of work.

## What this does not prove

- **Six classes, not all classes.** A defect shaped unlike these six has not been
  tested for.
- **One reader per class, one page per class.** This measures that the recipe CAN
  catch each class, not how reliably it does across a hundred pages.
- **The control is one page.** A false-positive rate measured on one clean page is
  a floor, not a rate.
- **The readers' own outputs were not preserved**, so "the reader caught it" is
  recorded here as prose and cannot be re-run. `inject.js` and the tool are
  reproducible; the reading is not.

Issue 273 runs this over all hundred and should be read with those four limits in
view.
