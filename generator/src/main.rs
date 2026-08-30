//! Renders the site to static HTML.
//!
//! Every page here is static: the Go server it replaces varied nothing per
//! request except the footer's copyright year, and two requests to the same
//! route returned identical bytes. So there is nothing to serve at runtime —
//! only files to write once and hand to a CDN, which is what actually moves
//! time-to-first-byte for readers and crawlers outside one datacentre.
//!
//! The pages are declared in site.toml, which the Node tooling reads too. That
//! is the point of the file: neither language parses the other's source, and
//! adding a page in one place brings the generator, the audits and the share
//! cards along with it.

use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process;

use htmd::HtmlToMarkdown;
use minijinja::value::Value;
use minijinja::{context, Environment, UndefinedBehavior};
use serde::Deserialize;

const ORIGIN: &str = "https://taux.io";

/// Where a path goes when nothing says otherwise (decision #58's "canonical
/// locale"). It is the destination of the root redirects and the language the
/// error document speaks.
///
/// THE 404 CANNOT BE MULTILINGUAL AND THAT IS A REAL LIMITATION, not an
/// oversight. The host answers every unmatched path with one file, chosen
/// before it knows anything about the reader, so its navigation has to point
/// somewhere concrete. Pointing it at `/` instead would hand every link on it
/// to the language sniff and cost a hop on each — worse, and still not the
/// reader's language until they click.
const CANONICAL_LOCALE: &str = "zh-Hant-TW";

/// The `?v=` on the stylesheet link, derived from the stylesheet's own bytes.
///
/// It used to be a literal in header.html. `_headers` caches `/static/css/*`
/// for an hour without `immutable`, and the comment there is explicit that the
/// query "is busted by a ?v= query that nothing enforces the incrementing of"
/// — betting on someone remembering. Nobody did: `v=25` was written during the
/// Go-to-Rust migration and never moved again through every palette, token and
/// type-scale change since, including two that shipped in one afternoon.
///
/// What that costs is bounded but real. A returning visitor holding the old
/// stylesheet gets the new markup styled by it until their cache expires — and
/// when the change introduced new utility classes, the elements wearing them
/// fall back to whatever the old rules said. A nav that reads `hidden sm:flex`
/// against a stylesheet with no `sm:flex` in it is simply hidden, at every
/// width.
///
/// Deriving it removes the class of bug rather than adding a reminder: the
/// query cannot lag the file it busts, because it is a function of that file.
/// FNV-1a rather than a cryptographic digest, and no new dependency for it —
/// this needs "differs when the bytes differ", not collision resistance.
fn css_version(css: &Path) -> Result<String, std::io::Error> {
    let bytes = fs::read(css)?;
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for b in bytes {
        hash ^= u64::from(b);
        hash = hash.wrapping_mul(0x1000_0000_01b3);
    }
    Ok(format!("{hash:016x}"))
}

/// One published language.
///
/// The roster is the published set rather than a plan: the switcher and the
/// hreflang block are generated from it, so an entry with no pages behind it
/// would point readers and crawlers at a 404.
#[derive(Debug, Deserialize, Clone)]
struct Locale {
    tag: String,
    name: String,
    og: String,
    /// The writing system. Read by five things rather than by the generator;
    /// declared here so they cannot each guess it differently. (This said
    /// "three" while `check:entity`, `heading structure`, geometry's `measure`,
    /// the OG card builder and the reading-measure table all read it.)
    #[allow(dead_code)]
    script: String,
    /// Prose that lives in a shared template and therefore cannot be translated
    /// by writing a second file. One key today; the alternative is an inline
    /// `{% if locale == ... %}`, which is a branch per language inside a file
    /// every language reads.
    #[serde(default)]
    strings: BTreeMap<String, String>,
}

#[derive(Debug, Deserialize)]
struct Site {
    #[serde(default)]
    locale: Vec<Locale>,
    page: Vec<Page>,
    /// Files the host serves for a condition rather than a path. They are
    /// rendered like any page but are not routes: nothing links to them and no
    /// audit walks them as URLs.
    #[serde(default)]
    document: Vec<Document>,
    /// Paths that used to be routes and now answer a redirect.
    #[serde(default)]
    redirect: Vec<Redirect>,
}

/// A path that has been retired, and where it goes now.
///
/// Declared in site.toml rather than hand-written into `_redirects`, for the
/// reason the sitemap is generated: a hand-maintained list of URLs drifts from
/// the pages it describes, and this project has already paid for that once.
#[derive(Debug, Deserialize)]
struct Redirect {
    from: String,
    to: String,
    #[serde(default = "permanent")]
    status: u16,
}

/// A retired path is retired permanently. A 302 would tell search engines to
/// keep the old URL, which is the opposite of what a rename is for.
fn permanent() -> u16 {
    301
}

#[derive(Debug, Deserialize)]
struct Document {
    template: String,
    output: String,
    title: String,
    description: String,
    /// Empty suppresses both `<link rel="canonical">` and `og:url`.
    ///
    /// The 404 document is served for every unmatched path *and* is addressable
    /// at `/404`, where a static host answers 200. A self-referencing canonical
    /// on that page invites an answer engine to index "this page does not exist"
    /// as a page. It has no canonical URL because it is not a document about
    /// anything; the empty string says that.
    canonical: String,
    /// Emits `<meta name="robots" content="noindex, follow">`.
    ///
    /// `follow` rather than `none`: the links in the header and footer are the
    /// site's real navigation and there is no reason to stop a crawler using
    /// them just because it should not index the page it found them on.
    #[serde(default)]
    noindex: bool,
}

/// The text of one page in one locale.
///
/// Split out from `Page` because everything above it — the path, the template,
/// the dates — is a property of the route, and everything here is a property of
/// the route *in a language*. Written as one flat table per page, this was
/// twenty entries; at five locales it would have been a hundred, hand-written,
/// with the path and template repeated five times each. site.toml's opening
/// comment is about exactly that: declared once, parsed by a real parser in
/// both languages.
#[derive(Debug, Deserialize)]
struct LocaleText {
    title: String,
    description: String,
    canonical: String,
    /// The template this language renders from, when it is not the route's.
    ///
    /// TRANSLATED PAGES NEED TRANSLATED TEMPLATES, and the route-level
    /// `template` cannot supply that: one file cannot hold two languages'
    /// prose. Without this the second locale would render the first locale's
    /// body under a translated title — a page that passes every gate, because
    /// no gate reads prose, and is wrong to every reader.
    ///
    /// Optional so the canonical locale keeps using the route's template and
    /// nothing has to be restated twenty times.
    #[serde(default)]
    template: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Page {
    path: String,
    template: String,
    /// Keyed by locale tag. A `BTreeMap` rather than a `HashMap` so the build is
    /// reproducible: the render order decides the order pages land in the
    /// sitemap, and a hash map would reshuffle it between runs.
    locale: BTreeMap<String, LocaleText>,
    /// When the page's content last changed. Required, and written by hand.
    ///
    /// This used to be derived from the commit that last touched the template,
    /// which was wrong in a way that got worse with every deploy: CI and
    /// Cloudflare Pages both clone shallowly, and in a one-commit history git
    /// attributes every file to that commit. Every page's date collapsed to the
    /// date of whatever was deployed last — a README typo would have restamped
    /// the whole site as freshly revised.
    ///
    /// So the build no longer reads git at all; it is reproducible from the tree
    /// alone. `npm run dates` compares what is declared here against what git
    /// knows, and a person decides. A mechanical commit that changes no content
    /// simply does not move the date, because nothing moves it automatically.
    date_modified: String,
    /// When the page was first published. A fact, so it is written by hand, and
    /// it has no default: a page whose template asks for it and whose entry does
    /// not supply it fails the build rather than borrowing another date.
    #[serde(default)]
    date_published: Option<String>,
    /// Emits `<meta name="robots" content="noindex, follow">`, same as on a
    /// document.
    ///
    /// It lives here as well as on `Document` because serde silently discards
    /// unknown keys: written on a `[[page]]` while only `Document` understood
    /// it, `noindex = true` parsed cleanly, rendered nothing, and left a page
    /// indexed with every gate green. Two entry kinds two blocks apart in
    /// site.toml, one of which honoured the flag and one of which ate it, is
    /// exactly the shape of defect nobody finds by reading.
    #[serde(default)]
    noindex: bool,
}

impl LocaleText {
    /// The slug the share card is filed under, derived from the canonical URL
    /// exactly as the card builder derives it. Deriving it from the route
    /// instead is how a page once advertised an image that was never generated.
    ///
    /// It hangs off the locale rather than the page because the canonical is
    /// per-locale: one route, one card per language.
    fn slug(&self) -> String {
        let s = self
            .canonical
            .strip_prefix(ORIGIN)
            .unwrap_or(&self.canonical)
            .trim_matches('/');
        if s.is_empty() {
            "index".to_string()
        } else {
            s.to_string()
        }
    }

    /// The YAML block that opens this locale's `.md`, and the reason it exists.
    ///
    /// A `.md` HAS NO `<head>`. Everything the HTML twin declares in one — the
    /// canonical URL, the language, the alternates — has nowhere else to live,
    /// so without this block a model holding the file cannot say where it came
    /// from. `url:` is the field the whole feature turns on: an answer engine
    /// quoting this content needs somewhere to point, and GEO is precisely the
    /// argument that being quoted without a citation is worth little.
    ///
    /// A METHOD RATHER THAN A FUNCTION TAKING THREE OF THESE FIELDS. It was the
    /// latter, and three of its five parameters were `title`, `description` and
    /// `canonical` off one `LocaleText` — the same clump `slug` above is a
    /// method to avoid.
    ///
    /// `alternates` stands in for hreflang, which Markdown has no form of. It is
    /// omitted rather than written empty when a route exists in one language
    /// only: an empty map advertises nothing and reads like a bug.
    fn front_matter(&self, locale: &str, alternates: &BTreeMap<String, String>) -> String {
        let mut out = String::from("---\n");
        out.push_str(&format!("title: {}\n", yaml_scalar(&self.title)));
        out.push_str(&format!(
            "description: {}\n",
            yaml_scalar(&self.description)
        ));
        out.push_str(&format!("url: {}\n", yaml_scalar(&self.canonical)));
        out.push_str(&format!("locale: {}\n", yaml_scalar(locale)));
        if !alternates.is_empty() {
            out.push_str("alternates:\n");
            for (tag, url) in alternates {
                out.push_str(&format!("  {tag}: {}\n", yaml_scalar(url)));
            }
        }
        out.push_str("---\n\n");
        out
    }
}

impl Page {
    /// Where the file has to land for the host to serve it at `path` without a
    /// visible .html.
    ///
    /// Every path carries a locale prefix and no locale lives at the root
    /// (decision #58). The root holds redirects only.
    ///
    /// THE LOCALE HOME IS A FLAT FILE, NOT A DIRECTORY INDEX, and the two
    /// layouts were measured against the host rather than reasoned about:
    ///
    /// ```text
    ///                                /zh-Hant-TW   /zh-Hant-TW/geo-guide
    ///   zh-Hant-TW/index.html        307 -> /..-TW/  200
    ///   zh-Hant-TW.html + zh-Hant-TW/  200          200
    /// ```
    ///
    /// The first costs a redirect hop on the highest-value URL each language
    /// has. The second serves every canonical form directly and answers the
    /// trailing-slash variants with a 307 back to it — the same invariant the
    /// site already holds, extended one level down rather than broken.
    ///
    /// So a locale's home is `<locale>.html` and its pages are
    /// `<locale>/<path>.html`. Those two coexist: a file and a directory with
    /// the same stem are different keys to the host.
    ///
    /// These URLs are indexed, so **none of them may change without leaving a
    /// redirect behind**. This used to read "none of them may change" flatly,
    /// which was the right instinct and the wrong rule: it gave no answer for
    /// the case where a path is genuinely misnamed, so the only options it left
    /// were to live with the name or to break every link pointing at it.
    /// Retiring a path is allowed; retiring it silently is not. Declare the old
    /// path under `[[redirect]]` in site.toml and the contract test will hold
    /// you to it.
    ///
    /// Flat files, not directories. `geo-guide/index.html` is served at
    /// `/geo-guide/`, and a request for `/geo-guide` is answered with a 308 to
    /// the trailing-slash form — a redirect hop on every indexed URL, and a
    /// canonical tag pointing somewhere the host will not serve directly.
    /// `geo-guide.html` is served at `/geo-guide` with no redirect at all.
    ///
    /// RELATIVE, NOT JOINED, AND THAT IS THE SECURITY-RELEVANT HALF. This
    /// returned `root.join(...)` until the build's containment check was found
    /// not to be one: `dest.strip_prefix(&out)` is a *lexical* comparison and
    /// does not resolve `..`, so `dist/en-US/../../escaped.html` stripped
    /// cleanly to `../../escaped.html`, still "started with" `dist`, and the
    /// file landed two levels above the output tree. The same unnormalised path
    /// then keyed the collision guard, so five locales produced five distinct
    /// `HashSet` entries naming one file — five destinations printed, one file
    /// written, exit 0.
    ///
    /// A joined path cannot be vetted after the fact. Returning the relative
    /// form is what lets `contained` check the components before the join, which
    /// is the only point at which the check means what it says.
    fn relative_output(&self, locale: &str) -> String {
        if self.path == "/" {
            return format!("{locale}.html");
        }
        // Error documents keep their literal name; the host maps status codes
        // to them by filename. They are not localised and take no prefix — the
        // host picks one file for an unmatched path and cannot know a language.
        if self.path.ends_with(".html") {
            return self.path.trim_start_matches('/').to_string();
        }
        format!("{locale}/{}.html", self.path.trim_start_matches('/'))
    }

    /// Where this route's Markdown twin lands, or `None` for a route that gets
    /// none.
    ///
    /// Derived from `relative_output` rather than rebuilt beside it. The three
    /// layouts that function picks between — a locale home is a flat file, an
    /// error document keeps its literal name, everything else takes a locale
    /// prefix — are exactly the rules the Markdown has to obey too, and a second
    /// copy of them is a second thing to keep in step.
    ///
    /// `noindex` IS WHY THIS RETURNS AN OPTION, and the reason is that Markdown
    /// cannot carry the flag. The HTML twin says `<meta name="robots"
    /// content="noindex, follow">`; a `.md` has no `<head>` to say it in and no
    /// header of its own to say it in either, so a `.md` beside a noindex page
    /// is a fully indexable copy of the one route deliberately kept out of an
    /// index. No page sets the flag today, which is what makes this a guard
    /// rather than a fix — and this repository's own decision #63 is that the
    /// difference between a guard and a comment is whether something enforces
    /// it.
    ///
    /// ⚠️ THE `.html` ARM IS UNREACHABLE FOR EVERY CURRENT CONFIG, and an
    /// earlier version of this comment presented it as live policy about error
    /// documents. It is not: /404 is a `[[document]]`, rendered by a different
    /// loop that never calls this, and no `[[page]]` path ends in `.html`. The
    /// arm is here because `relative_output` has the same branch, and two
    /// functions deriving one path must not disagree about which layouts exist.
    fn relative_markdown(&self, locale: &str) -> Option<String> {
        if self.noindex || self.path.ends_with(".html") {
            return None;
        }
        let html = self.relative_output(locale);
        let stem = html.strip_suffix(".html")?;
        Some(format!("{stem}.md"))
    }
}

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
    separate_block_halves(&separate_display_halves_within(heading))
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
        if has_text_outside_tags(&rest[..at]) {
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
/// `alternates` context above).
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
fn markdown_body(html: &str, canonical: &str) -> Result<String, Box<dyn std::error::Error>> {
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
fn yaml_scalar(raw: &str) -> String {
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

/// Resolves a site.toml-supplied destination against the output directory, and
/// refuses anything that would land outside it.
///
/// WHY THIS IS NOT `strip_prefix`. It was, for pages, and it was not a
/// containment check — see `Page::relative_output` for what `strip_prefix`
/// actually does to a path containing `..`. Documents had no check at all:
/// `out.join(&doc.output)` wrote wherever the string pointed, and `Path::join`
/// given an absolute path discards the base entirely, so a `[[document]]` could
/// write to any path the build user could reach.
///
/// The prefix check also fed the *collision* guard an unnormalised path, which
/// is how five locales could produce five distinct `HashSet` keys that all named
/// one file: the build printed five destinations, wrote one, and reported
/// success — the silent overwrite that guard exists to make loud.
///
/// REJECTING RATHER THAN NORMALISING IS DELIBERATE. No route or document name in
/// this site has a legitimate `..` or `.` in it, so a path carrying one is a
/// mistake or worse. Rewriting it silently would hide both, and the collision
/// guard keys on what the author wrote rather than on what it resolved to.
fn contained(out: &Path, rel: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let mut dest = out.to_path_buf();
    for component in Path::new(rel).components() {
        match component {
            Component::Normal(segment) => dest.push(segment),
            // `..`, `.`, a leading `/` and a Windows prefix all arrive here.
            // Every one of them either leaves the tree or resolves to a path
            // nobody wrote down.
            _ => {
                return Err(format!(
                    "{rel} is not a plain relative path — every page and document \
                     must land inside dist/"
                )
                .into())
            }
        }
    }
    Ok(dest)
}

/// Escapes the five characters that can leave an HTML attribute or an XML text
/// node, and NOTHING else.
///
/// WHY THIS EXISTS RATHER THAN minijinja's ESCAPER. The URLs below were handed
/// to templates as `Value::from_safe_string` — marked pre-escaped, escaped by
/// nothing — and the stated reason was real: minijinja's HTML escaper turns
/// every `/` into `&#x2f;`, so a canonical URL rendered as
/// `https:&#x2f;&#x2f;taux.io&#x2f;…`. Correct to a parser, noise to a reader,
/// and in `<loc>` it is noise a sitemap consumer has to undo.
///
/// But "escaping this would look ugly" is a reason to escape it differently,
/// not to stop escaping it. A `"` in a `canonical` closed the attribute and
/// everything after it was markup — on `<link rel=canonical>`, on `og:url`, on
/// `og:image` (which derives from the same field), on the hreflang set and on
/// the locale switcher, which is five sinks from one row of site.toml. The
/// audit reproduced it; the CSP does not contain it, because the injection is
/// attribute-level rather than an inline script.
///
/// `/` is safe in both contexts and stays as it is. So does everything else.
fn escape_markup(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for c in raw.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(c),
        }
    }
    out
}

/// A URL bound for an HTML attribute. Escaped for that context, then marked
/// safe so the template engine does not escape it a second time.
fn url_attr(raw: &str) -> Value {
    Value::from_safe_string(escape_markup(raw))
}

fn main() {
    if let Err(e) = run() {
        eprintln!("generate: {e}");
        process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let root = std::env::current_dir()?;
    let out = root.join("dist");

    let site: Site = toml::from_str(&fs::read_to_string(root.join("site.toml"))?)?;

    let mut env = Environment::new();
    env.set_loader(minijinja::path_loader(root.join("templates")));
    // A template that asks for something the page does not provide fails the
    // build. The permissive default renders it as empty, which is how a page
    // could have shipped an empty datePublished and looked fine.
    env.set_undefined_behavior(UndefinedBehavior::Strict);

    // A fresh tree each run, so a page removed from site.toml stops being
    // published rather than lingering as an orphan the audits never visit.
    if out.exists() {
        fs::remove_dir_all(&out)?;
    }
    fs::create_dir_all(&out)?;

    let year = current_year();
    // Read once and handed to every render. Failing here is correct: a missing
    // stylesheet means the build is broken, and emitting pages that link to a
    // file that is not there would hide it until someone loaded the site.
    let css_v = css_version(&root.join("static").join("css").join("styles.min.css"))?;
    let mut written = BTreeMap::new();
    let mut markdown_written = 0usize;
    let mut destinations: HashSet<PathBuf> = HashSet::new();
    let mut sitemap = Vec::new();

    // HOST CONFIGURATION IS COPIED BEFORE ANYTHING RENDERS, AND ITS NAME IS
    // RESERVED.
    //
    // This copy used to sit after the render loops, which left the repository's
    // own `_headers` a live target while they ran: a `[[document]]` whose
    // `output` climbed out of dist/ overwrote the source policy file, and this
    // copy then carried the replacement into the build. Cloudflare parses
    // `_headers` leniently — invalid rules are dropped, valid ones kept — so a
    // policy file full of HTML yields *zero* rules and every response ships with
    // no CSP, no X-Frame-Options and no Referrer-Policy. It is logged as a
    // warning, not an error, so nothing in the deploy path stops it.
    //
    // `contained` now refuses the climb, and copying first means the window is
    // shut even if that check is ever weakened. Reserving the names closes the
    // other half: a page or document may no longer land on one of these from
    // *inside* dist/ either. `sitemap.xml` and `_redirects` are generated below
    // rather than copied — a stale hand-edited copy in the repository root
    // cannot override the declared table — but they are reserved on the same
    // grounds, because a row quietly clobbered by a later write is the same
    // silent failure in a different direction.
    {
        // `.assetsignore` travels with `_headers` for the same reason: it is host
        // configuration, it belongs in the repository, and it has to be in the
        // uploaded directory to have any effect. It cannot simply be placed in
        // dist/ by hand — the wipe above removes it on every build.
        for name in ["_headers", ".assetsignore"] {
            let from = root.join(name);
            if from.exists() {
                fs::copy(&from, out.join(name))?;
            }
        }
        for reserved in ["_headers", ".assetsignore", "_redirects", "sitemap.xml"] {
            destinations.insert(PathBuf::from(reserved));
        }
    }

    // EVERY LANGUAGE THE SITE ACTUALLY PUBLISHES, FOR THE ONE NODE THAT IS NOT
    // PER-PAGE.
    //
    // The WebSite node in header.html has a locale-neutral `@id` — one site,
    // one node, shared by every page in every language. Its `inLanguage` was a
    // literal `zh-Hant-TW`, which was true while there was one language and
    // became a lie on all twenty English pages the moment there were two: the
    // same `@id` asserting a different language depending on which page a
    // crawler read it from. Per-page `{{ locale }}` would not fix it — it would
    // make the contradiction explicit.
    //
    // A list is the accurate answer, and it is derived rather than written
    // down. The roster is display order, not the published set (a roster entry
    // with no pages behind it is inert), so this is the union of the locales
    // pages actually declare, ordered by the roster.
    let site_locales: Vec<&str> = site
        .locale
        .iter()
        .map(|l| l.tag.as_str())
        .filter(|tag| site.page.iter().any(|p| p.locale.contains_key(*tag)))
        .collect();

    for page in &site.page {
        if page.locale.is_empty() {
            return Err(format!("{} declares no locale", page.path).into());
        }
        // EVERY LANGUAGE THIS ROUTE EXISTS IN, FOR hreflang AND THE SWITCHER.
        //
        // Built from the page's own locale table rather than the roster, and
        // the difference matters: a route that has not been translated yet must
        // not advertise an alternate it cannot serve. hreflang pointing at a 404
        // is worse than no hreflang — it tells a crawler the translation exists.
        //
        // Ordered by the roster so the switcher reads the same on every page,
        // rather than by the BTreeMap's alphabetical accident.
        let alternates: Vec<_> = site
            .locale
            .iter()
            .filter_map(|l| {
                page.locale.get(&l.tag).map(|t| {
                    context! {
                        tag => &l.tag,
                        name => &l.name,
                        // ABSOLUTE FOR hreflang, RELATIVE FOR THE SWITCHER, and
                        // they are two fields because they are two jobs.
                        //
                        // hreflang has to be fully qualified — a relative one is
                        // ignored. The switcher's href must NOT be: on a preview
                        // URL or a laptop, an absolute link walks the reader off
                        // the host they are looking at and onto production, so
                        // the one control that exists to be clicked during
                        // review is the one that cannot be reviewed.
                        url => url_attr(&t.canonical),
                        path => url_attr(t.canonical.strip_prefix(ORIGIN).unwrap_or("/")),
                    }
                })
            })
            .collect();

        for (locale, text) in &page.locale {
            let og_locale = site
                .locale
                .iter()
                .find(|l| &l.tag == locale)
                .map(|l| l.og.clone())
                .ok_or_else(|| {
                    // A page in a language the roster does not list would be
                    // built, linked and indexed while the switcher never
                    // mentions it. Loud, not silent.
                    format!(
                        "{} declares locale {locale}, which the roster does not list",
                        page.path
                    )
                })?;
            let tmpl = env.get_template(text.template.as_deref().unwrap_or(&page.template))?;
            // Titles and descriptions are escaped — one of them contains an
            // ampersand. The two URLs are not: they are ours, from site.toml, and
            // minijinja's HTML escaper turns every slash into &#x2f;, which is
            // decoded correctly by parsers but is noise no reader should be served.
            let html = tmpl.render(context! {
                // THE TEMPLATES ARE SHARED ACROSS LOCALES, SO LINKS CANNOT BE
                // LITERAL. header.html is one file rendered once per language;
                // writing `/zh-Hant-TW/geo-guide` into it would send an English
                // reader to the Chinese page. Every internal link is
                // `/{{ locale }}/...`, and the `locale relative links` rule
                // holds the templates to it.
                locale => locale,
                site_locales => &site_locales,
                og_locale => &og_locale,
                strings => site
                    .locale
                    .iter()
                    .find(|l| &l.tag == locale)
                    .map(|l| l.strings.clone())
                    .unwrap_or_default(),
                alternates => &alternates,
                title => &text.title,
                description => &text.description,
                canonical => url_attr(&text.canonical),
                // Passed explicitly rather than defaulted in the template because
                // UndefinedBehavior::Strict makes an absent variable a build error,
                // and that is the behaviour worth keeping.
                noindex => page.noindex,
                year => year,
                css_version => &css_v,
                og_image => url_attr(&format!("{ORIGIN}/static/og/{}.png", text.slug())),
                date_modified => &page.date_modified,
                ..match &page.date_published {
                    Some(d) => context! { date_published => d },
                    // Absent rather than empty, so a template that wants it fails
                    // loudly under the strict undefined behaviour set above.
                    None => context! {},
                }
            })?;
            let html = strip_comments(&html);

            sitemap.push((text.canonical.clone(), page.date_modified.clone()));

            let dest = contained(&out, &page.relative_output(locale))?;
            let rel = dest.strip_prefix(&out)?.to_path_buf();

            // TWO LOCALES MUST NOT LAND ON THE SAME FILE.
            //
            // `output_path` takes the locale now (issue 199 gave every path its
            // prefix), so the collision this guards against is no longer one
            // locale away — it takes a mistake in the layout rules to produce.
            // The rules are not obvious enough to trust: a locale home is a flat
            // `<locale>.html` rather than a directory index, a `path` ending in
            // `.html` keeps its own name and skips the prefix entirely, and the
            // two meet if a locale tag ever matches such a route's name (`/x.html`
            // and a locale `x` both land on `x.html`). Any of those returns two
            // identical paths from a function whose callers assume otherwise.
            //
            // WHY IT IS STILL WORTH A CHECK — the failure is silent everywhere
            // else. One file on disk, two entries in the sitemap, and every gate
            // green, because they all walk the route table rather than the tree.
            // check:entity is the only one that reads dist/, and it counts pages
            // against site.toml, so it would report the shortfall as a broken
            // build rather than as a collision.
            //
            // Guarded rather than remembered. This repo's notes open with what
            // silent failures have cost it.
            if !destinations.insert(rel.clone()) {
                return Err(format!(
                    "{} in {locale} would overwrite {} — two rows resolve to one \
                 file; see Page::output_path for the three layouts it picks between",
                    page.path,
                    rel.display()
                )
                .into());
            }

            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent)?;
            }

            // THE MARKDOWN TWIN (issue #255), WRITTEN BESIDE THE HTML AND FROM
            // THE SAME BYTES.
            //
            // It is here rather than in a second pass over dist/ for one
            // reason: a second pass is a second command, and a second command is
            // a thing someone runs an hour late or not at all. `build:site`
            // produces both or neither, so the two cannot drift.
            //
            // It is NOT a bot exemption and reads no request. Both files are
            // public and unconditional — anyone, human or crawler, can fetch
            // either. That is what keeps decision #59 out of this entirely, and
            // it is why `src/worker.js` needed no change: nothing here decides
            // anything per reader.
            if let Some(rel_md) = page.relative_markdown(locale) {
                let dest_md = contained(&out, &rel_md)?;
                let rel_md = dest_md.strip_prefix(&out)?.to_path_buf();

                // WHAT THIS ACTUALLY BUYS, which is narrower than the guard
                // it copies. A `.md` path is the `.html` path with its suffix
                // swapped, so two locales cannot collide here without having
                // collided above first — that case is already loud. The one it
                // catches on its own is a `[[document]]` whose `output` names a
                // `.md`: documents share this set, are written by a different
                // loop, and would otherwise overwrite a page's twin silently.
                //
                // It is the third copy of this block in the file. Left as a
                // copy rather than extracted, because the other two are not
                // this ticket's code and the error messages differ.
                if !destinations.insert(rel_md.clone()) {
                    return Err(format!(
                        "{} in {locale} would overwrite {}",
                        page.path,
                        rel_md.display()
                    )
                    .into());
                }

                // Every OTHER language this route exists in, and read off the
                // page's own table for the reason the hreflang set above is: a
                // route not yet translated must not advertise an alternate it
                // cannot serve.
                //
                // ⚠️ IT IS NOT BUILT "EXACTLY AS" THAT SET, which is what this
                // comment used to claim. That one walks `site.locale` so the
                // switcher reads in roster order on every page; this one walks
                // the BTreeMap and comes out sorted by tag. Both are
                // deterministic, and nothing renders this one, so the order is
                // free — but the two are different constructions and saying
                // otherwise sends the next reader looking for a shared shape
                // that is not there.
                let alternate_urls: BTreeMap<String, String> = page
                    .locale
                    .iter()
                    .filter(|(tag, _)| tag.as_str() != locale)
                    .map(|(tag, t)| (tag.clone(), t.canonical.clone()))
                    .collect();

                let markdown = format!(
                    "{}{}\n",
                    text.front_matter(locale, &alternate_urls),
                    markdown_body(&html, &text.canonical)?,
                );
                fs::write(&dest_md, markdown)?;
                markdown_written += 1;
            }

            fs::write(&dest, html)?;
            // KEYED BY PATH *AND* LOCALE. Keyed by path alone, the second
            // language of a route overwrote the first in this map: 22 files on
            // disk and "21 pages written" printed underneath them. The build
            // summary is the one place a person looks to see that a page was
            // produced, and it was quietly under-reporting by one per
            // translation.
            written.insert(format!("{} [{locale}]", page.path), rel);
        }
    }

    for doc in &site.document {
        let tmpl = env.get_template(&doc.template)?;
        let html = strip_comments(&tmpl.render(context! {
            // See CANONICAL_LOCALE: one file answers every unmatched path in
            // every language, so its navigation points at one of them.
            locale => CANONICAL_LOCALE,
            site_locales => &site_locales,
            strings => site
                .locale
                .iter()
                .find(|l| l.tag == CANONICAL_LOCALE)
                .map(|l| l.strings.clone())
                .unwrap_or_default(),
            og_locale => site
                .locale
                .iter()
                .find(|l| l.tag == CANONICAL_LOCALE)
                .map(|l| l.og.as_str())
                .unwrap_or("zh_TW"),
            // No alternates: the error document is one file for every language,
            // so it has no translations to point at.
            alternates => Vec::<Value>::new(),
            title => &doc.title,
            description => &doc.description,
            canonical => url_attr(&doc.canonical),
            noindex => doc.noindex,
            year => year,
            css_version => &css_v,
            og_image => url_attr(&format!("{ORIGIN}/static/og/index.png")),
        })?);
        // VETTED AND COLLISION-CHECKED EXACTLY LIKE A PAGE. It was neither.
        //
        // `out.join(&doc.output)` wrote wherever the string pointed — outside
        // dist/, or on top of a tracked file in the repository, so an ordinary
        // `npm run build:site` could mutate its own inputs. And documents never
        // entered `destinations`, so a document could silently replace a page
        // the loop above had just written, with the build still reporting both.
        let dest = contained(&out, &doc.output)?;
        let rel = dest.strip_prefix(&out)?.to_path_buf();
        if !destinations.insert(rel.clone()) {
            return Err(format!(
                "document {} would overwrite {} — two rows resolve to one file",
                doc.output,
                rel.display()
            )
            .into());
        }
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&dest, html)?;
        written.insert(format!("({})", doc.output), rel);
    }

    // Generated from the same table and the same dates as the pages, so a URL
    // cannot be missing from it and its lastmod cannot disagree with the
    // structured data — both of which were true of the file it replaces.
    let mut xml = String::from(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
         <urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n",
    );
    for (loc, lastmod) in &sitemap {
        xml.push_str(&format!(
            "  <url>\n    <loc>{}</loc>\n    <lastmod>{}</lastmod>\n  </url>\n",
            escape_markup(loc),
            escape_markup(lastmod)
        ));
    }
    xml.push_str("</urlset>\n");
    fs::write(out.join("sitemap.xml"), &xml)?;

    // Generated from the same table as the pages, for the same reason the
    // sitemap is: a hand-written list of URLs drifts from the thing it
    // describes and nothing notices. Written even when empty is avoided —
    // an empty file would be indistinguishable from a lost one.
    if !site.redirect.is_empty() {
        let mut redirects = String::new();
        for r in &site.redirect {
            redirects.push_str(&format!("{} {} {}\n", r.from, r.to, r.status));
        }
        fs::write(out.join("_redirects"), redirects)?;
    }

    copy_tree(&root.join("static"), &out.join("static"))?;

    // These sit at the root in the served site but live under static/ in the
    // repo, matching the routes the Go server exposed for them.
    for name in ["favicon.ico", "robots.txt", "llms.txt", "site.webmanifest"] {
        let from = root.join("static").join(name);
        if from.exists() {
            fs::copy(&from, out.join(name))?;
        }
    }

    for (path, file) in &written {
        println!("  {path:32} -> {}", file.display());
    }
    println!("\n{} pages written to dist/", written.len());
    // Counted separately rather than folded into `written`, which would double
    // the page count printed above it — the one number a person reads to check
    // the build did what they asked.
    println!("{markdown_written} Markdown twins written to dist/");
    Ok(())
}

/// Removes HTML comments from the output.
///
/// The templates carry a good deal of explanation — why the fonts are split by
/// script, why a radius step that looks unused has to stay — and none of it is
/// for readers. Go's html/template dropped comments silently, so this matches
/// what the site already served, and keeps internal notes about build scripts
/// out of the shipped page.
///
/// Script and style bodies are stepped over rather than scanned. No comment
/// currently sits inside one, but a `<!--` in a string literal or a CSS rule
/// would otherwise take everything up to the next `-->` with it.
fn strip_comments(html: &str) -> String {
    let mut out = String::with_capacity(html.len());
    let bytes = html.as_bytes();
    let mut i = 0;

    while i < bytes.len() {
        if html[i..].starts_with("<!--") {
            match html[i..].find("-->") {
                Some(end) => {
                    i += end + 3;
                    // Leave the line the comment sat on rather than gluing its
                    // neighbours together.
                    continue;
                }
                None => break,
            }
        }

        // Script bodies are copied through untouched: a `<!--` inside a string
        // literal would otherwise swallow everything to the next `-->`.
        if html[i..].starts_with("<script") {
            if let Some(end) = html[i..].find("</script>") {
                let stop = i + end + "</script>".len();
                out.push_str(&html[i..stop]);
                i = stop;
                // Back to the top, so a comment sitting immediately after the
                // closing tag is still recognised. Falling through to the plain
                // character copy below emitted its `<` and left the rest of the
                // comment as ordinary text.
                continue;
            }
        }
        // Style bodies keep their CSS but lose their CSS comments, for the same
        // reason the HTML comments go: the one in this site explains a palette
        // decision to whoever edits the template, not to whoever reads the page.
        if html[i..].starts_with("<style") {
            if let Some(end) = html[i..].find("</style>") {
                let stop = i + end + "</style>".len();
                out.push_str(&strip_css_comments(&html[i..stop]));
                i = stop;
                continue;
            }
        }
        if i >= bytes.len() {
            break;
        }

        let ch = html[i..].chars().next().unwrap();
        out.push(ch);
        i += ch.len_utf8();
    }
    out
}

/// Removes `/* … */` from CSS, leaving anything inside a quoted string alone.
///
/// No declaration in this site currently puts a comment opener inside a string,
/// but a `content: "/*"` would be silently eaten by a scanner that did not
/// track quoting, and the damage would not show until something visual broke.
fn strip_css_comments(css: &str) -> String {
    let mut out = String::with_capacity(css.len());
    let mut chars = css.char_indices().peekable();
    let mut quote: Option<char> = None;

    while let Some((i, c)) = chars.next() {
        if let Some(q) = quote {
            out.push(c);
            if c == '\\' {
                if let Some((_, esc)) = chars.next() {
                    out.push(esc);
                }
            } else if c == q {
                quote = None;
            }
            continue;
        }
        if c == '"' || c == '\'' {
            quote = Some(c);
            out.push(c);
            continue;
        }
        if c == '/' && matches!(chars.peek(), Some((_, '*'))) {
            if let Some(end) = css[i..].find("*/") {
                let stop = i + end + 2;
                while let Some(&(j, _)) = chars.peek() {
                    if j >= stop {
                        break;
                    }
                    chars.next();
                }
                // A comment separates tokens in CSS, so it leaves a space
                // behind. Deleting it outright would turn `a/*x*/b` into `ab`.
                out.push(' ');
                continue;
            }
        }
        out.push(c);
    }
    out
}

fn copy_tree(from: &Path, to: &Path) -> std::io::Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let dest = to.join(entry.file_name());
        // SYMLINKS ARE REFUSED, NOT FOLLOWED.
        //
        // `file_type()` does not traverse, so a symlink reports neither a file
        // nor a directory and used to fall to the `fs::copy` below — which DOES
        // traverse, and copies the target's bytes. A link committed under
        // static/ therefore published whatever it pointed at on the build
        // machine, one arbitrary file per link, straight to the public site.
        //
        // Refused rather than skipped: nothing in this repository has ever
        // needed a symlink in static/, so one appearing is either a mistake or
        // the thing described above, and both are worth stopping the build for.
        // Skipping silently would publish a site missing an asset instead.
        let kind = entry.file_type()?;
        if kind.is_symlink() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!(
                    "{} is a symlink — static/ is copied verbatim and a link would \
                     publish whatever it points at on the build machine",
                    entry.path().display()
                ),
            ));
        }
        if kind.is_dir() {
            copy_tree(&entry.path(), &dest)?;
        } else {
            fs::copy(entry.path(), dest)?;
        }
    }
    Ok(())
}

/// Baked at build time. The Go server read the clock on every request to fill
/// in a copyright year, which is the only thing it did that a file cannot —
/// and a rebuild once a year is a cheaper answer than a server.
fn current_year() -> i32 {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let days = secs / 86_400;
    // Civil-from-days, Howard Hinnant's algorithm.
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let y = yoe + era * 400;
    (y + if mp >= 10 { 1 } else { 0 }) as i32
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_LOCALE: &str = "zh-Hant-TW";

    fn page(path: &str, canonical: &str) -> Page {
        Page {
            path: path.to_string(),
            template: "t.html".to_string(),
            locale: BTreeMap::from([(TEST_LOCALE.to_string(), text(canonical))]),
            date_modified: "2026-01-01".to_string(),
            date_published: None,
            noindex: false,
        }
    }

    fn text(canonical: &str) -> LocaleText {
        LocaleText {
            title: String::new(),
            description: String::new(),
            canonical: canonical.to_string(),
            template: None,
        }
    }

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

    const CANON: &str = "https://taux.io/zh-Hant-TW/geo-guide";

    fn titled(title: &str, description: &str, canonical: &str) -> LocaleText {
        LocaleText {
            title: title.to_string(),
            description: description.to_string(),
            canonical: canonical.to_string(),
            template: None,
        }
    }

    #[test]
    fn a_locale_home_gets_a_flat_markdown_file() {
        let p = page("/", "https://taux.io/zh-Hant-TW");
        assert_eq!(
            p.relative_markdown(TEST_LOCALE).as_deref(),
            Some("zh-Hant-TW.md")
        );
    }

    #[test]
    fn a_page_gets_a_markdown_sibling_under_its_locale() {
        let p = page("/geo-guide", CANON);
        assert_eq!(
            p.relative_markdown(TEST_LOCALE).as_deref(),
            Some("zh-Hant-TW/geo-guide.md")
        );
    }

    // Markdown carries no `<head>` and no headers of its own, so there is
    // nowhere to repeat `<meta name="robots" content="noindex">`. A twin beside
    // a noindex page is a fully indexable copy of the one route deliberately
    // kept out of an index.
    #[test]
    fn a_noindex_page_gets_no_markdown() {
        let mut p = page("/geo-guide", CANON);
        p.noindex = true;
        assert_eq!(p.relative_markdown(TEST_LOCALE), None);
    }

    // Unreachable for every current config — /404 is a `[[document]]`, rendered
    // by a loop that never calls this — and asserted anyway, because
    // `relative_output` keeps the same branch and the two must not disagree
    // about which layouts exist.
    #[test]
    fn a_dot_html_route_would_get_no_markdown() {
        let p = page("/404.html", "https://taux.io/404");
        assert_eq!(p.relative_markdown(TEST_LOCALE), None);
    }

    // A `.md` path must pass the same containment check as its HTML twin, or
    // the audit that made `relative_output` return a relative path buys nothing
    // for half the files the build writes.
    #[test]
    fn markdown_paths_are_contained_too() {
        let p = page("/../escaped", "https://taux.io/x");
        let rel = p.relative_markdown(TEST_LOCALE).unwrap();
        assert!(contained(Path::new("dist"), &rel).is_err());
    }

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
    // THE TWELVE BELOW COVER WHAT `check:md` CANNOT REACH, and only that. The
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

    // `url:` is the reason the front matter exists: an answer engine quoting
    // this file needs somewhere to point, and a `.md` carries no canonical tag.
    #[test]
    fn front_matter_carries_the_canonical_url() {
        let fm = titled("GEO 完整指南", "指南描述", CANON).front_matter(
            TEST_LOCALE,
            &BTreeMap::from([(
                "en-US".to_string(),
                "https://taux.io/en-US/geo-guide".to_string(),
            )]),
        );
        assert!(fm.starts_with("---\n"));
        assert!(fm.ends_with("---\n\n"));
        assert!(fm.contains(&format!("url: \"{CANON}\"\n")));
        assert!(fm.contains("locale: \"zh-Hant-TW\"\n"));
        assert!(fm.contains("  en-US: \"https://taux.io/en-US/geo-guide\"\n"));
    }

    // A title holding a quote or a colon would otherwise end the scalar early
    // and produce front matter that parses as something else — or not at all.
    #[test]
    fn front_matter_scalars_are_quoted_and_escaped() {
        let fm =
            titled(r#"A "quoted": title"#, "d", CANON).front_matter(TEST_LOCALE, &BTreeMap::new());
        assert!(fm.contains(r#"title: "A \"quoted\": title""#), "got:\n{fm}");
    }

    // The doc comment claimed "every string" while the body escaped three
    // characters. A `\r` is one keystroke from invalid YAML.
    #[test]
    fn control_characters_are_escaped_not_only_the_obvious_ones() {
        assert_eq!(yaml_scalar("a\rb\u{1}c"), r#""a\rb\x01c""#);
    }

    // Nothing else declares which language a `.md` is in, and the alternates are
    // the only thing standing in for hreflang, which Markdown has no form of.
    #[test]
    fn a_page_in_one_language_lists_no_alternates() {
        let fm = titled("t", "d", CANON).front_matter(TEST_LOCALE, &BTreeMap::new());
        assert!(!fm.contains("alternates:"), "got:\n{fm}");
    }

    // Every URL below is already indexed, so these are not style preferences.
    // A page written to `geo-guide/index.html` is served at `/geo-guide/` and the
    // bare path answers 308 — a redirect hop on an indexed URL, and a canonical
    // tag pointing at a form the host will not serve directly.

    // A LOCALE'S HOME IS A FLAT FILE, NOT A DIRECTORY INDEX, and the two layouts
    // were measured against the host rather than argued about:
    //
    //   zh-Hant-TW/index.html   /zh-Hant-TW -> 307 to the trailing-slash form
    //   zh-Hant-TW.html         /zh-Hant-TW -> 200
    //
    // That hop would land on the highest-value URL each language has.
    #[test]
    fn a_locale_home_is_a_flat_file() {
        let out = page("/", "https://taux.io/zh-Hant-TW").relative_output(TEST_LOCALE);
        assert_eq!(out, "zh-Hant-TW.html");
    }

    #[test]
    fn routes_become_flat_files_under_their_locale() {
        let out =
            page("/geo-guide", "https://taux.io/zh-Hant-TW/geo-guide").relative_output(TEST_LOCALE);
        assert_eq!(out, "zh-Hant-TW/geo-guide.html");
    }

    // Nothing may land on the same file twice. The generator guards this at
    // build time too; here it is the property that guard depends on.
    #[test]
    fn two_locales_do_not_share_a_file() {
        let p = page("/geo-guide", "https://taux.io/zh-Hant-TW/geo-guide");
        assert_ne!(p.relative_output("zh-Hant-TW"), p.relative_output("en-US"));
    }

    // The host answers every unmatched path with one file, chosen before it
    // knows anything about the reader, so the error document takes no prefix.
    #[test]
    fn a_path_that_is_already_a_filename_keeps_its_name() {
        let out = page("/404.html", "https://taux.io/404").relative_output(TEST_LOCALE);
        assert_eq!(out, "404.html");
    }

    // THE URLs THAT WERE MARKED SAFE AND ESCAPED BY NOTHING.
    //
    // One `canonical` in site.toml reaches five attribute sinks — the canonical
    // link, og:url, og:image (via slug), the hreflang set and the switcher — so
    // a `"` in it closed the attribute on every one of them. Reproduced by the
    // audit; the CSP does not contain it, because the injection is attribute
    // level rather than an inline script.

    #[test]
    fn a_quote_in_a_url_cannot_close_the_attribute() {
        let out = escape_markup(r#"https://taux.io/x"><script>alert(1)</script>"#);
        assert!(!out.contains('"'), "{out}");
        assert!(!out.contains('<'), "{out}");
        assert_eq!(
            out,
            "https://taux.io/x&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"
        );
    }

    // The reason the URLs were left raw in the first place. minijinja's escaper
    // turns every slash into `&#x2f;`, which is correct and unreadable; this
    // one leaves them alone, so the fix does not reintroduce the noise it was
    // avoiding.
    #[test]
    fn slashes_and_ordinary_urls_pass_through_untouched() {
        let url = "https://taux.io/zh-Hant-TW/geo-guide";
        assert_eq!(escape_markup(url), url);
    }

    // A bare `&` is legal in a URL and illegal in XML text, so the sitemap was
    // one query string away from being malformed with nobody at fault.
    #[test]
    fn an_ampersand_is_escaped_for_the_sitemap() {
        assert_eq!(
            escape_markup("https://taux.io/x?a=1&b=2"),
            "https://taux.io/x?a=1&amp;b=2"
        );
    }

    // THE GUARD THAT WAS A PREFIX CHECK.
    //
    // `dest.strip_prefix(&out)` does not resolve `..`, so the check that was
    // supposed to keep every write inside dist/ returned Ok for paths that leave
    // it, and documents had no check at all. These assert the property the old
    // code only appeared to have. Each one is a destination that reached the
    // filesystem before `contained` existed.

    #[test]
    fn a_destination_cannot_climb_out_of_dist() {
        // The one that mattered: dist/../_headers is the repository's own
        // security policy, copied into the build immediately afterwards.
        assert!(contained(Path::new("dist"), "../_headers").is_err());
        assert!(contained(Path::new("dist"), "../../escaped.html").is_err());
        assert!(contained(Path::new("dist"), "../static/robots.txt").is_err());
        // The climb does not have to be at the front to work.
        assert!(contained(Path::new("dist"), "en-US/../../escaped.html").is_err());
    }

    #[test]
    fn an_absolute_destination_is_rejected() {
        // `Path::join` given an absolute path discards the base entirely, so
        // this wrote where the string pointed rather than under dist/.
        assert!(contained(Path::new("dist"), "/tmp/anywhere.html").is_err());
    }

    #[test]
    fn a_single_dot_is_rejected_too() {
        // Harmless on its own. Rejected because it resolves to a path nobody
        // wrote down, and the collision guard keys on what they did write —
        // `./404.html` and `404.html` are one file and two keys.
        assert!(contained(Path::new("dist"), "./404.html").is_err());
    }

    // The guard must not cost the generator a layout it actually uses. All three
    // that `relative_output` picks between have to pass through unchanged.
    #[test]
    fn the_three_layouts_all_survive_containment() {
        for rel in [
            page("/", "https://taux.io/zh-Hant-TW").relative_output(TEST_LOCALE),
            page("/geo-guide", "https://taux.io/zh-Hant-TW/geo-guide").relative_output(TEST_LOCALE),
            page("/404.html", "https://taux.io/404").relative_output(TEST_LOCALE),
        ] {
            assert_eq!(
                contained(Path::new("dist"), &rel).unwrap(),
                Path::new("dist").join(&rel),
                "{rel} is a layout this site uses and must not be refused"
            );
        }
    }

    // Five locales once produced five distinct HashSet keys naming one file, so
    // the collision guard never fired: the build printed five destinations,
    // wrote one, and exited 0. Now every locale is refused at the same place.
    #[test]
    fn a_climbing_route_is_refused_for_every_locale() {
        let p = page("/../../escaped", "https://taux.io/x");
        for locale in ["zh-Hant-TW", "en-US", "ja-JP", "ko-KR", "zh-Hans-CN"] {
            assert!(contained(Path::new("dist"), &p.relative_output(locale)).is_err());
        }
    }

    // The share-card builder derives the same slug from the same canonical URL.
    // Deriving it from the route instead is how a page once advertised an image
    // that was never generated. The slug now carries the locale, so the card
    // lands beside the page rather than colliding with its translations.
    #[test]
    fn slug_comes_from_the_canonical_url() {
        assert_eq!(
            text("https://taux.io/zh-Hant-TW/geo-guide").slug(),
            "zh-Hant-TW/geo-guide"
        );
    }

    #[test]
    fn the_home_page_slug_is_the_locale() {
        assert_eq!(text("https://taux.io/zh-Hant-TW").slug(), "zh-Hant-TW");
        assert_eq!(text("https://taux.io/zh-Hant-TW/").slug(), "zh-Hant-TW");
    }

    // A retired path defaults to 301 rather than 302. A temporary redirect
    // tells search engines to keep indexing the old URL, which is the opposite
    // of what retiring a path is for — and the default is what almost every
    // entry will use, so getting it wrong would be quiet and widespread.
    #[test]
    fn a_redirect_is_permanent_unless_it_says_otherwise() {
        let site: Site = toml::from_str(
            r#"
            page = []
            [[redirect]]
            from = "/old"
            to   = "/new"
            "#,
        )
        .unwrap();
        assert_eq!(site.redirect[0].status, 301);
    }

    #[test]
    fn comments_are_removed() {
        assert_eq!(
            strip_comments("<p>a</p><!-- note --><p>b</p>"),
            "<p>a</p><p>b</p>"
        );
    }

    // Stepping over a script or style body used to fall through to the plain
    // character copy without retesting for a comment opener, so a comment sitting
    // immediately after the closing tag was emitted verbatim. No template put one
    // there, which is exactly why nothing caught it.
    #[test]
    fn a_comment_right_after_a_script_is_removed() {
        assert_eq!(
            strip_comments("<script>x</script><!-- note --><p>b</p>"),
            "<script>x</script><p>b</p>"
        );
    }

    #[test]
    fn a_comment_right_after_a_style_is_removed() {
        assert_eq!(
            strip_comments("<style>a{b:c}</style><!-- note --><p>b</p>"),
            "<style>a{b:c}</style><p>b</p>"
        );
    }

    // A `<!--` inside a script string literal would otherwise swallow everything
    // up to the next `-->`.
    #[test]
    fn script_bodies_are_not_scanned_for_comments() {
        let html = r#"<script>var s = "<!-- not a comment -->";</script>"#;
        assert_eq!(strip_comments(html), html);
    }

    // Go stripped these too, and the migration had to match it byte for byte.
    // The space matters: `a/*x*/b` is two tokens, `ab` is one.
    #[test]
    fn css_comments_are_replaced_by_a_space() {
        assert_eq!(strip_css_comments("a/*x*/b"), "a b");
    }

    #[test]
    fn a_comment_opener_inside_a_css_string_is_left_alone() {
        assert_eq!(
            strip_css_comments(r#"a{content:"/*"}"#),
            r#"a{content:"/*"}"#
        );
    }
}
