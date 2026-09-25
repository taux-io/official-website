//! The Markdown twin of every page: the `<main>` cut, the passes the output
//! turned out to need, and the conversion.

use htmd::HtmlToMarkdown;

use crate::ORIGIN;

/// Replaces every `<br>` in `html` with `with`.
///
/// Split out because the two callers want opposite things from the same tag: a
/// heading wants it gone, a code sample wants it to be the line break it is.
fn replace_breaks(html: &str, with: &str) -> String {
    let mut out = String::with_capacity(html.len());
    let mut rest = html;
    while let Some(at) = rest.find("<br") {
        let after = &rest[at + 3..];
        // `<br` has to start a tag rather than a longer name. Nothing in these
        // templates is called `<break>`, but the check costs one line and the
        // alternative is a silent mangling nobody would look for.
        if !(after.starts_with('>')
            || after.starts_with('/')
            || after.starts_with(char::is_whitespace))
        {
            out.push_str(&rest[..at + 3]);
            rest = after;
            continue;
        }
        let Some(gt) = after.find('>') else { break };
        out.push_str(&rest[..at]);
        out.push_str(with);
        rest = &after[gt + 1..];
    }
    out.push_str(rest);
    out
}

/// Turns a `<br>` inside a heading into a space.
///
/// FOUND BY READING THE OUTPUT, NOT BY READING THE CODE, and it was wrong on
/// the five highest-value pages on the site. A Markdown ATX heading is one
/// line, so the hard break `htmd` correctly emits for `<br>` *ends* it:
///
/// ```text
///   <h1><span>Empower Your Business<br>with AI</span><span>…</span></h1>
///
///   # Empower Your Business          <- the whole H1, as far as any parser
///   with AI …                        <- a stray paragraph
/// ```
///
/// Every locale home shipped that, and the H1 is the strongest signal in a file
/// whose entire purpose is to be read and quoted by a model. The break is
/// typographic — index.html's own comment says it is written rather than left
/// to the container because the measured line width differs by machine — so a
/// space is what it means once the line is not being laid out.
///
/// Headings do not nest, so a single scan is enough.
fn flatten_heading_breaks(html: &str) -> String {
    let mut out = String::with_capacity(html.len());
    let mut rest = html;
    loop {
        let Some((at, level)) = (1..=6)
            .filter_map(|n| rest.find(&format!("<h{n}")).map(|i| (i, n)))
            .min_by_key(|(i, _)| *i)
        else {
            break;
        };
        let Some(end) = rest[at..].find(&format!("</h{level}>")).map(|i| at + i) else {
            break;
        };
        out.push_str(&rest[..at]);
        out.push_str(&replace_breaks(&rest[at..end], " "));
        rest = &rest[end..];
    }
    out.push_str(rest);
    out
}

/// The separator between the two halves of a bilingual heading.
///
/// `scripts/check-md.js` holds the same constant and asserts the separated form
/// is present in all hundred files. Change one and the other goes red, which is
/// the point of writing it down twice rather than once.
const HEADING_SEPARATOR: &str = " \u{2014} ";

/// The class prefix that marks the two halves of a bilingual heading.
const DISPLAY_PREFIX: &str = "display-";

/// The class token that marks the second half in the OTHER heading shape.
const BLOCK_HALF: &str = "block";

/// Puts that separator between `display-lead` and `display-sub`.
///
/// FOUND BY READING `dist/ja-JP/about.md`, FIFTEEN LINES IN, with nine
/// `check:md` assertions and 1564 production assertions green. Headings are
/// built from two spans — the English lead and the locale's own words — and CSS
/// lays them out as two lines. Markdown has no CSS and an ATX heading is one
/// line, so `htmd` joins the siblings with the single space it would use inside
/// a sentence:
///
/// ```text
///   <h1><span class="display-lead">Empowering Business with AI</span>
///       <span class="display-sub">AI を、企業が本当に使える力に</span></h1>
///
///   # Empowering Business with AI AI を、企業が本当に使える力に
/// ```
///
/// A HUNDRED AND SIXTY HEADINGS ACROSS EIGHTY FILES. Not only the H1 — the same
/// pair builds the section headings, so the first count taken (eighty, one per
/// file) was of first headings and was wrong by half.
///
/// ⚠️ THE OBVIOUS FIX IS THE WRONG ONE. Dropping the English half and keeping
/// the local one reads better in four locales and destroys the fifth: en-US has
/// no `display-sub` at all, so forty of its headings are a lead alone and would
/// be left with nothing. Measuring one locale would have shipped that.
///
/// Inserting a text node rather than rewriting the spans keeps this a pass over
/// markup, like the two beside it, and leaves the attribute layer alone.
///
/// ⚠️ THE LINE NUMBER ABOVE WAS WRONG WHEN FIRST WRITTEN — it said eighteen.
/// The chip is on line thirteen and the glued heading on line fifteen. A
/// remembered number in a comment whose whole subject is a mis-measurement is
/// the same defect one layer up.
fn separate_display_halves(html: &str) -> String {
    let mut out = String::with_capacity(html.len() + 32);
    let mut rest = html;
    loop {
        let Some((at, level)) = (1..=6)
            .filter_map(|n| rest.find(&format!("<h{n}")).map(|i| (i, n)))
            .min_by_key(|(i, _)| *i)
        else {
            break;
        };
        let Some(end) = rest[at..].find(&format!("</h{level}>")).map(|i| at + i) else {
            break;
        };
        out.push_str(&rest[..at]);
        out.push_str(&separate_halves_within(&rest[at..end]));
        rest = &rest[end..];
    }
    out.push_str(rest);
    out
}

/// The body of the pass above, over one heading.
///
/// A sub with no lead before it is left alone: it is a heading in one language,
/// and a leading separator would be noise. Once a lead has been seen, EVERY sub
/// after it is separated rather than only the first — no heading carries two
/// today, and the version that stopped at the first would have glued the second
/// silently on the day one did.
///
/// ⚠️ AND A SECOND SHAPE, WHICH THIS PASS DID NOT KNOW ABOUT FOR TWO ISSUES.
/// The templates also build the same heading without either class: the locale
/// half as the heading's own text, the English half in a `class="block"` span.
///
/// ```text
///   <h2>プロンプトインジェクション<span class="block …">Prompt Injection</span></h2>
///
///   ## プロンプトインジェクションPrompt Injection
/// ```
///
/// SEVENTY-FIVE HEADINGS ACROSS TEN PAGES shipped glued that way while twelve
/// `check:md` assertions stayed green — the assertion looked for the same pair
/// of classes this pass did, so the fix and its gate were blind together. Found
/// by the audit in issue 273, by a reader looking at the twins.
fn separate_halves_within(heading: &str) -> String {
    // BADGE FIRST. It writes a separator right after the number, and the block
    // pass refuses to add a second one when it already sees one there. The
    // other order puts the block pass first, so its guard has nothing to see
    // yet and a badge followed straight by a block half comes out `1 —  — X`.
    // The test for that failed with the passes the other way round, which is
    // why the order is written down rather than left to read like an accident.
    separate_block_halves(&separate_number_badge(&separate_display_halves_within(
        heading,
    )))
}

/// The number badge: a heading's first element holding nothing but digits.
///
/// The templates draw a section number as a circle — `<span class="w-12 h-12
/// …">1</span>` before the title. Markdown has no circle, so it arrives as a
/// bare numeral touching the words after it:
///
/// ```text
///   ## 1 Part one: the basics
///   ## 1 第 1 部：基礎（Prompting 101）
/// ```
///
/// FIFTY HEADINGS ACROSS FIFTEEN PAGES.
///
/// ⚠️ IDENTIFIED BY WHAT IT IS, NOT BY WHAT IT WEARS. The two passes above this
/// one match a class — `display-`, then a `block` token — and the first version
/// of each was narrow enough that a template rewrite would have escaped the fix
/// AND its gate together. That happened twice. A badge is instead "the first
/// element whose text is only digits", which no class rename can undo.
/// Measured: fifty such elements in this build, every one leading its heading,
/// and no other digit-only element in any heading at all.
///
/// ⚠️ WHAT IT CANNOT SEE, since a rule that only lists what it catches is half
/// a rule. A roman numeral, a spelled-out `One`, a `1.` with its stop, digits
/// wrapped twice (`<span><span>1</span></span>`), or an icon sitting before the
/// number all fall outside it and are left glued. And it cannot tell a section
/// number from any other bare numeral: a heading opening `<span>2024</span> in
/// review` would be separated as though the year were a badge. Zero of each in
/// this build; none of that is checked on every run, only measured once.
///
/// ⚠️ SEPARATED, NOT DROPPED — and dropping was the obvious answer. FORTY of
/// the fifty badges are the ONLY number their heading has (`01` before `Tool
/// Wrapper`, `1` before `What is llms.txt?`), so dropping loses which section
/// is which. The other TEN sit before a title that already says the number
/// (`Part one`, `第 1 部`, `1부`), where dropping loses nothing. One rule has to
/// serve both, and keeping is the side that is recoverable.
///
/// ⚠️ THIS PARAGRAPH SAID "25 + 25" AND "half … the other half", from three
/// page families counted as two. Measured: `adk-skill-patterns` 25,
/// `what-is-llms-txt` 15, `agent-prompting-guide` 10 — so 40 / 10, not 25 / 25.
/// Tenth wrong number on this line of work, in the sentence that argues for the
/// decision, one paragraph after a comment congratulating itself for counting
/// the ninth. A first attempt to re-count it was wrong too: testing whether the
/// title contains a DIGIT gives 44 / 6, because `Part one` and `第一部分` spell
/// the number out.
///
/// The separated form is this site's own convention rather than an invention:
/// pages that write their number as literal text already write `01 — 一句話`.
fn separate_number_badge(heading: &str) -> String {
    // `end_of_tag`, not a bare `find('>')`. The helper exists eight lines above
    // `has_text_outside_tags` precisely because an attribute value can hold a
    // `>` — Tailwind writes `[&>svg]:` — and the comment there says so. Writing
    // the bare search anyway, in the same file, is how the warning stops being
    // one.
    let Some(open) = end_of_tag(&heading[1..]).map(|i| i + 2) else {
        return heading.to_string();
    };
    let rest = &heading[open..];
    let trimmed = rest.trim_start();
    if !trimmed.starts_with('<') {
        return heading.to_string();
    }
    let Some(close) = end_of_tag(&trimmed[1..]).map(|i| i + 1) else {
        return heading.to_string();
    };
    let name: String = trimmed[1..]
        .chars()
        .take_while(|c| c.is_ascii_alphanumeric())
        .collect();
    if name.is_empty() {
        return heading.to_string();
    }
    let after = &trimmed[close + 1..];
    let end_tag = format!("</{name}>");
    let Some(end) = after.find(&end_tag) else {
        return heading.to_string();
    };
    if after[..end].trim().is_empty() || !after[..end].trim().chars().all(|c| c.is_ascii_digit()) {
        return heading.to_string();
    }
    let tail = &after[end + end_tag.len()..];
    if !has_text_outside_tags(tail) {
        return heading.to_string();
    }
    let mut out = String::with_capacity(heading.len() + HEADING_SEPARATOR.len());
    out.push_str(&heading[..open]);
    out.push_str(&trimmed[..close + 1]);
    out.push_str(&after[..end]);
    out.push_str(&end_tag);
    out.push_str(HEADING_SEPARATOR);
    out.push_str(tail);
    out
}

/// Whether markup holds any text of its own, tags not counted.
///
/// ⚠️ THE FIRST VERSION ASKED WHETHER THE MARKUP WAS BLANK, which the slice
/// before the span never is — it opens with the `<h2>` itself. So the guard for
/// "a span with nothing before it" never fired, and such a heading would have
/// been given a leading em dash: the same defect pointing the other way. No page
/// carries one, so nothing would have said so; the test did, on its first run.
fn has_text_outside_tags(markup: &str) -> bool {
    let mut rest = markup;
    loop {
        // A `<` only opens a tag when a name or a slash follows it. These pages
        // teach prompt injection, so their prose carries `<fixed-point>` and
        // `<name>` as literal text — and an attribute value can carry `>`
        // (Tailwind writes `[&>svg]:…`), which would otherwise end a tag early
        // and let the attribute string count as visible words.
        let Some(at) = rest.find('<') else {
            return rest.chars().any(|c| !c.is_whitespace());
        };
        if rest[..at].chars().any(|c| !c.is_whitespace()) {
            return true;
        }
        let after = &rest[at + 1..];
        if !after.starts_with(|c: char| c.is_ascii_alphabetic() || c == '/') {
            return true;
        }
        let Some(gt) = end_of_tag(after) else {
            return false;
        };
        rest = &after[gt + 1..];
    }
}

/// The offset of the `>` that ends an opening tag, skipping quoted values.
fn end_of_tag(after: &str) -> Option<usize> {
    let mut quote = None;
    for (at, ch) in after.char_indices() {
        match (quote, ch) {
            (None, '"') | (None, '\'') => quote = Some(ch),
            (Some(q), c) if c == q => quote = None,
            (None, '>') => return Some(at),
            _ => {}
        }
    }
    None
}

/// The second shape: text, then an element carrying the other half.
///
/// The separator goes before that element's opening `<`, so whatever whitespace
/// the template happens to leave collapses around it. Three locales write a
/// space there (en-US, zh-Hans-CN, zh-Hant-TW — 45 headings) and two write
/// nothing (ja-JP, ko-KR — 30); both end up with the same separator, which is
/// the point — a space is what a sentence puts between words, not what marks a
/// boundary between languages.
///
/// An element with no text before it is left alone: that is a heading in one
/// language whose only content happens to be wrapped.
///
/// ⚠️ MATCHED AS A CLASS TOKEN, ON ANY ELEMENT, and the first version did
/// neither. It looked for the literal `class="block`, which requires `class` to
/// open the tag and `block` to open the class, and it accepted any element only
/// by accident of matching an attribute rather than a tag. `class="text-base
/// block"` would have escaped it — AND escaped `check:md`, because the
/// assertion was written to the same narrow shape. That is the third time on
/// this line of work that a fix and its gate were blinded together by sharing a
/// definition; the second time is quoted in `check-md.js`'s tenth assertion,
/// which this version was written directly beneath.
fn separate_block_halves(heading: &str) -> String {
    let mut out = String::with_capacity(heading.len() + HEADING_SEPARATOR.len());
    let mut rest = heading;
    while let Some(at) = find_block_half(rest) {
        // ⚠️ NOT IF A SEPARATOR IS ALREADY THERE. The badge pass writes one
        // immediately before whatever follows the number, so a heading that is
        // a badge followed straight by a block half would get two — `1 —  — X`.
        // No page carries that shape; it is one line to make impossible and the
        // pipeline order alone is not an argument.
        let already = rest[..at]
            .trim_end()
            .ends_with(HEADING_SEPARATOR.trim_end());
        if !already && has_text_outside_tags(&rest[..at]) {
            out.push_str(&rest[..at]);
            out.push_str(HEADING_SEPARATOR);
        } else {
            out.push_str(&rest[..at]);
        }
        let step = rest[at..]
            .find('>')
            .map(|i| at + i + 1)
            .unwrap_or(rest.len());
        out.push_str(&rest[at..step]);
        rest = &rest[step..];
    }
    out.push_str(rest);
    out
}

/// The offset of the next opening tag whose class carries the `block` token.
fn find_block_half(heading: &str) -> Option<usize> {
    let mut from = 0usize;
    while let Some(at) = heading[from..].find('<').map(|i| from + i) {
        let after = &heading[at + 1..];
        if !after.starts_with(|c: char| c.is_ascii_alphabetic()) {
            from = at + 1;
            continue;
        }
        let gt = after.find('>')?;
        if class_has_token(&after[..gt], BLOCK_HALF) {
            return Some(at);
        }
        from = at + 1 + gt;
    }
    None
}

/// The `display-lead` / `display-sub` shape (issue 270).
///
/// A sub with no lead before it is left alone: it is a heading in one language,
/// and a leading separator would be noise. Once a lead has been seen, EVERY sub
/// after it is separated rather than only the first — no heading carries two
/// today, and the version that stopped at the first would have glued the second
/// silently on the day one did.
fn separate_display_halves_within(heading: &str) -> String {
    let mut out = String::with_capacity(heading.len() + HEADING_SEPARATOR.len());
    let mut rest = heading;
    let mut seen_lead = false;
    while let Some(at) = rest.find(DISPLAY_PREFIX) {
        let after = at + DISPLAY_PREFIX.len();
        let kind = &rest[after..];
        if kind.starts_with("lead") {
            seen_lead = true;
            out.push_str(&rest[..after]);
            rest = kind;
            continue;
        }
        if !kind.starts_with("sub") || !seen_lead {
            out.push_str(&rest[..after]);
            rest = kind;
            continue;
        }
        // Back up to the `<` that opens this span, so the separator lands
        // between the two elements rather than inside the second one.
        let Some(open) = rest[..at].rfind('<') else {
            out.push_str(&rest[..after]);
            rest = kind;
            continue;
        };
        out.push_str(&rest[..open]);
        out.push_str(HEADING_SEPARATOR);
        out.push_str(&rest[open..after]);
        rest = kind;
    }
    out.push_str(rest);
    out
}

/// Removes the decorative chip that sits above a heading.
///
/// `class="tag …"` draws a small rounded pill. On the page its shape says it is
/// a label; in Markdown there is no shape, so it lands as a bare line above the
/// H1 and reads as a sentence the page is making. Sixty of them, across sixty
/// files, shipped that way.
///
/// ⚠️ THE ARGUMENT FOR DROPPING THEM WAS PARTLY FALSE AS FIRST MADE, AND THE
/// CORRECTION WAS WRONG TOO. The first version said they are English chrome
/// nobody ever translated. The second said ten of the sixty carry localised
/// text. Counted: TWELVE carry CJK (`GEO 技術觀點`, `GEO の技術メモ`,
/// `GEO 기술 노트`, and their Simplified siblings), and thirteen are non-ASCII
/// once `Google Cloud Tech — notes` is included for its em dash. They go anyway,
/// but for the surviving reason: a chip is not a sentence, and the front matter
/// already carries the title and description a citation needs.
///
/// WHY NOT `skip_tags`. `htmd` skips by tag name, and these are ordinary `<div>`
/// and `<span>` — the whole page is made of those. The class is the only thing
/// that identifies them, and only the markup layer can see it.
///
/// ⚠️ THE CLASS IS MATCHED AS A TOKEN, NOT AS A PREFIX OF THE ATTRIBUTE. The
/// first version looked for the literal `<div class="tag`, which requires
/// `class` to be the first attribute and `tag` to be its first word. Both are
/// true of every chip today and neither is a rule anywhere. A template written
/// `class="mb-6 tag"` would have kept its chip — and `check:md`'s assertion used
/// the same shape, so the gate would have missed it in the same breath. The
/// gate now looks for the token on ANY element, which is deliberately wider than
/// what this drops: if this pass ever stops seeing a chip, the gate still does.
///
/// Depth-counted rather than matched to the first close tag. Nothing nests one
/// inside another today; nothing stops a chip gaining a wrapper tomorrow, and
/// the failure would be a silently truncated page rather than a build error.
/// The offset of the next `<name …>` whose `class` attribute carries the token.
fn find_pill(html: &str, name: &str) -> Option<usize> {
    let open = format!("<{name}");
    let mut from = 0usize;
    while let Some(at) = html[from..].find(&open).map(|i| from + i) {
        let after = &html[at + open.len()..];
        // `<div` must open a tag, not be the start of a longer name.
        if !(after.starts_with('>') || after.starts_with(char::is_whitespace)) {
            from = at + open.len();
            continue;
        }
        let gt = after.find('>')?;
        if class_has_token(&after[..gt], "tag") {
            return Some(at);
        }
        from = at + open.len() + gt;
    }
    None
}

/// Whether the attribute text of one opening tag carries `token` in its class.
///
/// Whitespace-separated, which is what a class attribute is. `tagline` is not
/// `tag`, and `mb-6 tag` is.
fn class_has_token(attrs: &str, token: &str) -> bool {
    let Some(at) = attrs.find("class=\"") else {
        return false;
    };
    let rest = &attrs[at + 7..];
    let Some(end) = rest.find('"') else {
        return false;
    };
    rest[..end].split_whitespace().any(|word| word == token)
}

fn drop_tag_pills(html: &str) -> String {
    let mut out = String::with_capacity(html.len());
    let mut rest = html;
    'scan: loop {
        let Some((at, name)) = ["div", "span"]
            .iter()
            .filter_map(|n| find_pill(rest, n).map(|i| (i, *n)))
            .min_by_key(|(i, _)| *i)
        else {
            break;
        };
        let open = format!("<{name}");
        let close = format!("</{name}>");
        let mut depth = 1usize;
        let mut cursor = at + open.len();
        loop {
            let next_open = rest[cursor..].find(&open).map(|i| cursor + i);
            let Some(next_close) = rest[cursor..].find(&close).map(|i| cursor + i) else {
                // Unbalanced markup. Leaving the chip in place is a visible
                // defect; swallowing the rest of the page is not.
                break 'scan;
            };
            match next_open {
                Some(o) if o < next_close => {
                    depth += 1;
                    cursor = o + open.len();
                }
                _ => {
                    depth -= 1;
                    cursor = next_close + close.len();
                    if depth == 0 {
                        break;
                    }
                }
            }
        }
        out.push_str(&rest[..at]);
        rest = &rest[cursor..];
    }
    out.push_str(rest);
    out
}

/// Rewrites the URLs in `<main>` so that they still resolve once the Markdown
/// has been copied somewhere else.
///
/// TWO KINDS, AND THE SECOND WAS MISSED THE FIRST TIME. Root-relative
/// (`/zh-Hant-TW/geo-guide`) and fragment-only (`#speed`). The fragment case is
/// not an edge: fifteen of the twenty routes open with a section index built
/// entirely out of `href="#…"`, so leaving them alone shipped the exact failure
/// this comment claimed to prevent, on three quarters of the pages, while the
/// test that was supposed to cover it passed.
///
/// WHY THIS RUNS ON THE HTML AND NOT ON THE MARKDOWN. Rewriting `](/…` after the
/// fact means re-deciding, from text, which parentheses are a link target — and
/// the pages carry code samples, so some of them are not. The attribute is
/// unambiguous while it is still an attribute.
///
/// WHY IT MATTERS AT ALL. The whole point of the `.md` twin is that a model
/// copies it somewhere else. Both forms survive that move as links to nothing on
/// whatever host they land on — silently, and the reader blames this site. The
/// templates cannot simply be written absolute instead: `header.html` is one
/// file rendered per language, and the switcher's href must stay relative or a
/// review on a preview URL walks the reviewer onto production (see the
/// `alternates` context in `render_pages`, main.rs).
///
/// ⚠️ IT MATCHES TEXT AS READILY AS ATTRIBUTES. A code sample containing the
/// literal string `href="/x"` would be rewritten as though it were markup.
/// Verified that no template contains one today; nothing checks that it stays
/// true, which is worth knowing rather than worth a parser.
///
/// `//host/path` is left alone. It is already absolute; prefixing it produces
/// `https://taux.io//host/path`, which resolves nowhere.
fn absolutise(html: &str, canonical: &str) -> String {
    let prefixes = [
        ("href=\"/", format!("{ORIGIN}/")),
        ("src=\"/", format!("{ORIGIN}/")),
        ("href=\"#", format!("{canonical}#")),
    ];
    let mut out = String::with_capacity(html.len() + 64);
    let mut rest = html;
    while let Some((at, needle, replacement)) = prefixes
        .iter()
        .filter_map(|(n, r)| rest.find(n).map(|i| (i, *n, r)))
        .min_by_key(|(i, _, _)| *i)
    {
        out.push_str(&rest[..at]);
        let after = &rest[at + needle.len()..];
        if needle.ends_with('/') && after.starts_with('/') {
            out.push_str(needle);
        } else {
            // Everything but the byte the needle ends in, which the replacement
            // supplies along with the origin.
            out.push_str(&needle[..needle.len() - 1]);
            out.push_str(replacement);
        }
        rest = after;
    }
    out.push_str(rest);
    out
}

/// The inner HTML of the page's `<main>`, or an error.
///
/// FAILING IS THE POINT. Measured before this was written: 100 of 100 rendered
/// pages carry exactly one `<main>`, so the cut is stable — and a page that
/// stops carrying one is a template change nobody meant to make. The
/// alternative, falling back to the whole body, ships a `.md` whose first few
/// hundred tokens are the navigation and the footer, which is the precise thing
/// this feature exists to stop, and it ships it silently.
fn main_content(html: &str) -> Result<&str, Box<dyn std::error::Error>> {
    let open = html
        .find("<main")
        .ok_or("no <main> in the rendered page — the Markdown twin has nothing to cut")?;
    let body = html[open..]
        .find('>')
        .map(|i| open + i + 1)
        .ok_or("unterminated <main> tag")?;
    let close = html[body..]
        .find("</main>")
        .map(|i| body + i)
        .ok_or("no </main> in the rendered page")?;
    Ok(&html[body..close])
}

/// A rendered page's `<main>`, as Markdown.
///
/// Three passes, each here because the output was read afterwards rather than
/// reasoned about beforehand:
///
///   - headings lose their `<br>`, or the H1 ends at it (`flatten_heading_breaks`)
///   - links become absolute, both `/…` and `#…` (`absolutise`)
///   - `skip_tags` drops the decorative SVG — seven of geo-guide's nine live
///     inside `<main>`, and converted rather than dropped they are `<path>`
///     noise occupying the tokens this feature exists to free up. `script`,
///     `style` and `noscript` go with them for the same reason.
///
/// THERE WERE FIVE, AND TWO ARE GONE BECAUSE THE MARKUP GOT FIXED INSTEAD.
/// They rescued code samples the templates had not declared as code — a
/// `div.code-window` drawn out of styled spans, and a `<pre>` carrying no
/// `<code>`. Both shapes are gone (issue 264): the templates say `<pre><code>`
/// now, so `htmd` needs no help and a screen reader is finally told what it is
/// looking at.
///
/// ⚠️ THE COUNT ABOVE WAS "TWO PASSES" AND "THREE ARE GONE", and it was wrong
/// in both halves — `skip_tags` is a pass and was still bulleted here, and only
/// two passes went (the other two deletions were their helpers). The paragraph
/// was also inserted mid-list, which orphaned that bullet below it. Written out
/// rather than quietly corrected, because a docstring that miscounts what the
/// function does is the drift this repository's checks exist to catch.
///
/// What replaced them is a gate, not nothing. `check:md` asserts that every
/// `<pre>` inside `<main>` carries a `<code>`, and that `code-window` names a
/// `<pre>` and never a `<div>` — the two properties those passes papered over,
/// and papering over the first is how forty-five code blocks shipped as prose
/// while every gate stayed green. Decision #63 asks for the rule to have
/// something checking it.
///
/// Tables need no pass: `htmd` emits GFM natively, and a model reads a GFM table
/// as a table where GEO-vs-SEO flattened to prose stops being a comparison.
///
/// AN EMPTY BODY IS AN ERROR, not a small file. A `<main>` holding nothing but
/// skipped tags yields front matter and blank space — written, counted and
/// green, which is the shape of silent failure this repository's notes open by
/// naming.
pub(crate) fn markdown_body(
    html: &str,
    canonical: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    let main = main_content(html)?;
    let prepared = absolutise(
        &separate_display_halves(&drop_tag_pills(&flatten_heading_breaks(main))),
        canonical,
    );
    let converter = HtmlToMarkdown::builder()
        .skip_tags(vec!["svg", "script", "style", "noscript"])
        .build();
    let body = converter.convert(&prepared)?.trim().to_string();
    if body.is_empty() {
        return Err(format!("{canonical} converts to an empty Markdown body").into());
    }
    Ok(body)
}

/// A YAML double-quoted scalar.
///
/// Every string in the front matter goes through this rather than only the ones
/// that look risky today. A title holding a colon, a quote or a backslash ends
/// the scalar early and produces front matter that parses as something other
/// than what was written — or does not parse at all — and nothing downstream
/// would say so.
///
/// ⚠️ THIS COMMENT WAS TRUE OF THE INTENT AND FALSE OF THE CODE. It said "every
/// string" while the body escaped exactly `"`, `\` and `\n`, so a `\r` — or any
/// other C0 control — passed through literally and produced invalid YAML, one
/// character away from the failure the function exists to prevent. The
/// exhaustive arm below is what makes the sentence above true.
pub(crate) fn yaml_scalar(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len() + 2);
    out.push('"');
    for c in raw.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            // Every remaining C0 control, and DEL. YAML spells these `\xNN` in a
            // double-quoted scalar; a literal one makes the document invalid.
            c if (c as u32) < 0x20 || c as u32 == 0x7f => {
                out.push_str(&format!("\\x{:02x}", c as u32));
            }
            _ => out.push(c),
        }
    }
    out.push('"');
    out
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    // ── The Markdown twin of every page (issue #255) ────────────────────────
    //
    // These assert the SHAPE OF THE FILE, not how the conversion reaches it.
    // The conversion is `htmd`'s job and is not this repo's to test; what is
    // this repo's is the four passes the output turned out to need, plus the
    // front matter, which exists because a `.md` has no `<head>` and therefore
    // nothing else carries the canonical URL.
    //
    // ⚠️ FOUR OF THESE EXIST BECAUSE THE FIRST ROUND OF TESTS PASSED WHILE THE
    // OUTPUT WAS WRONG — a truncated H1 on all five locale homes, escaped
    // Markdown in twenty-five code samples, dead fragment links on three
    // quarters of the routes, and an unreachable `None` arm dressed up as
    // policy. Every one was found by reading `dist/`, not by reading the code.

    pub(crate) const CANON: &str = "https://taux.io/zh-Hant-TW/geo-guide";

    #[test]
    fn only_main_survives() {
        let html = "<body><header>NAV</header><main><p>Body</p></main><footer>FOOT</footer></body>";
        let md = markdown_body(html, CANON).unwrap();
        assert!(md.contains("Body"));
        assert!(!md.contains("NAV"));
        assert!(!md.contains("FOOT"));
    }

    // Measured: 100 of 100 rendered pages carry a `<main>`. A page that stops
    // doing so is a template change nobody meant to make, so it fails the build
    // rather than shipping a `.md` holding the whole chrome.
    #[test]
    fn a_page_without_main_fails_the_build() {
        assert!(markdown_body("<body><p>no main here</p></body>", CANON).is_err());
    }

    // Written, counted and green is how a half-tree gets shipped. `check:entity`
    // exists because that happened once already.
    #[test]
    fn a_main_that_converts_to_nothing_fails_the_build() {
        assert!(markdown_body("<main><svg><path d=\"M0 0\"/></svg></main>", CANON).is_err());
    }

    // Seven of the nine SVGs on geo-guide live inside `<main>`. They are
    // decorative icons; converted rather than dropped they are `<path>` noise
    // occupying the tokens this whole feature exists to free up.
    #[test]
    fn decorative_svg_is_dropped() {
        let html = r#"<main><p>Before</p><svg viewBox="0 0 24 24"><path d="M12 2L2 7"/></svg><p>After</p></main>"#;
        let md = markdown_body(html, CANON).unwrap();
        assert!(md.contains("Before") && md.contains("After"));
        assert!(!md.contains("path"));
        assert!(!md.contains("M12 2L2 7"));
    }

    // THE H1 WAS TRUNCATED ON ALL FIVE LOCALE HOMES. A Markdown heading is one
    // line, so the hard break `htmd` correctly emits for `<br>` ended it and the
    // rest became a stray paragraph. The break is typographic — index.html's
    // comment says it is written rather than left to the container because the
    // measured line width differs by machine — so a space is what it means.
    #[test]
    fn a_break_inside_a_heading_becomes_a_space() {
        let html = "<main><h1><span>Empower Your Business<br>with AI</span></h1></main>";
        let md = markdown_body(html, CANON).unwrap();
        assert!(
            md.lines().next().unwrap() == "# Empower Your Business with AI",
            "got:\n{md}"
        );
    }

    // A `<br>` outside a heading is a real line break and keeps being one.
    #[test]
    fn a_break_outside_a_heading_is_left_alone() {
        let html = "<main><p>one<br>two</p></main>";
        let md = markdown_body(html, CANON).unwrap();
        assert!(md.contains('\n'), "got:\n{md}");
    }

    // WHY THIS SURVIVED THE RESCUE PASSES IT WAS WRITTEN FOR. One of
    // agent-dev-workflow's samples is a CLAUDE.md, and while its `<pre>` had no
    // `<code>` that sample's `## Agent behaviour` was promoted into the page's
    // own heading hierarchy — a model reading the outline saw a section that
    // does not exist. The markup declares itself now (issue 264), so the
    // rescue is gone; the property it protected is not optional, and this is
    // what still asserts it of the conversion itself.
    // THE SEVENTEEN BELOW COVER WHAT `check:md` CANNOT REACH, and only that. The
    // positive cases — a bilingual heading that separates, a chip that goes —
    // are asserted over all hundred real files by assertions 9 and 10 there,
    // which is a stronger statement than any synthetic string makes. These are
    // the branches no page exercises today, where the first sign of a mistake
    // would be a silently shortened page rather than a red build.
    //
    // ⚠️ THIS COUNT HAS NOW BEEN WRONG TWICE. It said three while four followed
    // it, and the correction said six while seven followed it. Both were written
    // by counting the list by eye. `NOTES.md` records the same failure three
    // times about the gate list, and draws the same conclusion: the list is the
    // only source, and a number beside it is a second one. Count it, do not
    // remember it.

    #[test]
    fn a_heading_in_one_language_gets_no_separator() {
        // en-US has forty of these: a lead with no sub after it. A separator
        // here would be a dangling em dash on twenty English pages.
        let html = r#"<h2><span class="display-lead">Our Mission</span></h2>"#;
        assert_eq!(separate_display_halves(html), html);
    }

    #[test]
    fn a_sub_with_no_lead_before_it_is_left_alone() {
        let html = r#"<h2><span class="display-sub">核心使命</span></h2>"#;
        assert_eq!(separate_display_halves(html), html);
    }

    #[test]
    fn a_pill_takes_its_nested_markup_with_it() {
        // Every chip that carries the little dot is a `<div>` holding a
        // `<span>`, so no chip nests inside its own tag name today. Matching the
        // first close tag would work until one does, and would then eat the rest
        // of the page rather than fail.
        let html =
            r#"<p>before</p><div class="tag mb-6"><div class="dot"></div> Label</div><p>after</p>"#;
        assert_eq!(drop_tag_pills(html), "<p>before</p><p>after</p>");
    }

    #[test]
    fn a_badge_straight_before_a_block_half_gets_one_separator_not_two() {
        let html = concat!(
            r#"<h2><span class="w-12 h-12">1</span>"#,
            r#"<span class="block">English</span></h2>"#
        );
        assert_eq!(separate_display_halves(html).matches('\u{2014}').count(), 1);
    }

    #[test]
    fn a_greater_than_in_the_headings_own_attributes_does_not_hide_the_badge() {
        // The `<h2>` itself can carry `[&>svg]:` in a class. A bare `find('>')`
        // would treat that as the end of the opening tag and start reading the
        // badge from the middle of an attribute.
        let html = r#"<h2 class="[&>svg]:w-4"><span class="w-12 h-12">1</span> Title</h2>"#;
        assert!(separate_display_halves(html).contains("\u{2014}"));
    }

    #[test]
    fn a_number_that_is_not_the_first_element_is_not_a_badge() {
        // Zero headings carry one. A numeral inside the title is part of the
        // title, and separating it would cut a sentence in half.
        let html = r#"<h2>Step<span class="w-12 h-12">1</span></h2>"#;
        assert_eq!(separate_display_halves(html), html);
    }

    #[test]
    fn a_badge_with_no_title_after_it_is_left_alone() {
        let html = r#"<h2><span class="w-12 h-12">1</span></h2>"#;
        assert_eq!(separate_display_halves(html), html);
    }

    #[test]
    fn an_element_holding_digits_and_letters_is_not_a_badge() {
        // `1a` is a label the page wrote, not a section number the template drew.
        let html = r#"<h2><span class="w-12 h-12">1a</span> Title</h2>"#;
        assert_eq!(separate_display_halves(html), html);
    }

    #[test]
    fn a_literal_angle_bracket_before_the_span_still_counts_as_text() {
        // The pages teach prompt injection, so `<fixed-point>` appears as prose.
        let html = r#"<h2>&lt;name&gt; の話<span class="block">On names</span></h2>"#;
        assert!(separate_display_halves(html).contains("\u{2014}"));
    }

    #[test]
    fn a_greater_than_inside_an_attribute_is_not_the_end_of_the_tag() {
        // Tailwind writes `[&>svg]:` in a class. Ending the tag there would let
        // the attribute string count as visible words and produce a leading
        // separator on a heading that has no first half.
        let html = r#"<h2><i class="[&>svg]:w-4"></i><span class="block">Only half</span></h2>"#;
        assert_eq!(separate_display_halves(html), html);
    }

    #[test]
    fn the_class_token_is_matched_on_any_element_not_just_a_span() {
        let html = r#"<h2>治理<strong class="text-base block">Governance</strong></h2>"#;
        assert!(separate_display_halves(html).contains("\u{2014}"));
    }

    #[test]
    fn a_block_span_with_nothing_before_it_gets_no_separator() {
        // A heading whose whole content happens to be wrapped. Zero pages carry
        // one; a leading em dash would be the same defect pointing the other way.
        let html = r#"<h2><span class="block text-base">Governance</span></h2>"#;
        assert_eq!(separate_display_halves(html), html);
    }

    #[test]
    fn every_block_span_after_text_is_separated() {
        let html = concat!(
            r#"<h2>治理<span class="block">Governance</span>"#,
            r#"<span class="block">Again</span></h2>"#
        );
        assert_eq!(separate_display_halves(html).matches('\u{2014}').count(), 2);
    }

    #[test]
    fn a_second_sub_after_one_lead_is_separated_too() {
        let html = concat!(
            r#"<h1><span class="display-lead">Lead</span>"#,
            r#"<span class="display-sub">One</span>"#,
            r#"<span class="display-sub">Two</span></h1>"#
        );
        let out = separate_display_halves(html);
        assert_eq!(out.matches('\u{2014}').count(), 2);
    }

    #[test]
    fn a_chip_is_found_however_its_class_is_written() {
        // `class` need not open the tag and `tag` need not open the class. The
        // first version of this pass required both, and `check:md` required them
        // too, so a template written either way would have been missed twice.
        let html = r#"<p>a</p><div id="x" class="mb-6 tag">Label</div><p>b</p>"#;
        assert_eq!(drop_tag_pills(html), "<p>a</p><p>b</p>");
    }

    #[test]
    fn a_class_that_merely_starts_with_tag_is_not_a_chip() {
        let html = r#"<div class="tagline">Not a chip</div>"#;
        assert_eq!(drop_tag_pills(html), html);
    }

    #[test]
    fn unbalanced_markup_keeps_the_chip_rather_than_swallowing_the_page() {
        let html = r#"<div class="tag mb-6">Label<p>everything after</p>"#;
        assert_eq!(drop_tag_pills(html), html);
    }

    #[test]
    fn markdown_inside_a_pre_does_not_become_document_structure() {
        let html = "<main><h2>Real</h2><pre><code>## Fake heading\n- item</code></pre></main>";
        let md = markdown_body(html, CANON).unwrap();
        // Fence-aware on purpose. A `##` inside a code block is text, and the
        // first version of this assertion could not tell the difference — it
        // failed on the fixed output while describing the broken one.
        let mut fenced = false;
        let headings: Vec<&str> = md
            .lines()
            .filter(|l| {
                if l.starts_with("```") {
                    fenced = !fenced;
                    return false;
                }
                !fenced && l.starts_with("## ")
            })
            .collect();
        assert_eq!(headings, vec!["## Real"], "got:\n{md}");
    }

    // Twenty of the sixty-five are already `<pre><code>` and convert correctly.
    // Wrapping them again would nest a code block inside a code block.
    #[test]
    fn a_pre_that_already_has_code_is_left_alone() {
        let html = "<main><pre><code>already semantic</code></pre></main>";
        let md = markdown_body(html, CANON).unwrap();
        assert_eq!(md.matches("```").count(), 2, "got:\n{md}");
        assert!(md.contains("already semantic"), "got:\n{md}");
    }

    // A model copies this Markdown somewhere else. A root-relative link survives
    // that move as a dead link, silently, and the reader blames the site.
    #[test]
    fn internal_links_become_absolute() {
        let html = r#"<main><p><a href="/zh-Hant-TW/geo-guide">Guide</a></p></main>"#;
        let md = markdown_body(html, CANON).unwrap();
        assert!(
            md.contains("(https://taux.io/zh-Hant-TW/geo-guide)"),
            "got:\n{md}"
        );
    }

    // Fifteen of the twenty routes open with a section index built entirely out
    // of `href="#…"`. They were shipped untouched while the test above passed.
    #[test]
    fn fragment_links_are_resolved_against_this_page() {
        let html = r##"<main><p><a href="#speed">Speed</a></p></main>"##;
        let md = markdown_body(html, CANON).unwrap();
        assert!(md.contains(&format!("({CANON}#speed)")), "got:\n{md}");
    }

    // The link points at the HTML, not at the `.md`. Whoever follows a citation
    // is a person, and a person should land on the page.
    #[test]
    fn absolute_links_are_left_alone() {
        let html = r#"<main><p><a href="https://example.com/x">X</a></p></main>"#;
        let md = markdown_body(html, CANON).unwrap();
        assert!(md.contains("(https://example.com/x)"), "got:\n{md}");
    }

    #[test]
    fn protocol_relative_urls_are_not_rewritten() {
        assert_eq!(
            absolutise(r#"<img src="//cdn.example.com/a.png">"#, CANON),
            r#"<img src="//cdn.example.com/a.png">"#
        );
    }

    // GEO vs SEO is a table, and a model reads a GFM table as a table. Flattened
    // to prose it stops being a comparison at all.
    #[test]
    fn tables_survive_as_gfm() {
        let html = "<main><table><thead><tr><th>維度</th><th>SEO</th></tr></thead>\
                    <tbody><tr><td>目標</td><td>排名</td></tr></tbody></table></main>";
        let md = markdown_body(html, CANON).unwrap();
        let rows: Vec<&str> = md.lines().map(str::trim).collect();
        // Asserted as GFM's three parts rather than as an exact string: htmd
        // sizes the separator's dashes to the column and pads the cells, and
        // pinning that would be testing htmd's layout rather than this repo's
        // rule. What matters is that a parser still sees a table.
        assert!(rows[0].starts_with('|') && rows[0].contains("維度") && rows[0].contains("SEO"));
        assert!(
            rows[1].starts_with('|')
                && rows[1].contains("-")
                && rows[1].chars().all(|c| "|- ".contains(c)),
            "separator row, got: {}",
            rows[1]
        );
        assert!(rows[2].starts_with('|') && rows[2].contains("目標") && rows[2].contains("排名"));
    }

    // The doc comment claimed "every string" while the body escaped three
    // characters. A `\r` is one keystroke from invalid YAML.
    #[test]
    fn control_characters_are_escaped_not_only_the_obvious_ones() {
        assert_eq!(yaml_scalar("a\rb\u{1}c"), r#""a\rb\x01c""#);
    }
}
