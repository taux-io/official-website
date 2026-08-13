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
use std::path::{Path, PathBuf};
use std::process;

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
    /// The writing system. Read by three checks rather than by the generator;
    /// declared here so they cannot each guess it differently.
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
    fn output_path(&self, root: &Path, locale: &str) -> PathBuf {
        if self.path == "/" {
            return root.join(format!("{locale}.html"));
        }
        // Error documents keep their literal name; the host maps status codes
        // to them by filename. They are not localised and take no prefix — the
        // host picks one file for an unmatched path and cannot know a language.
        if self.path.ends_with(".html") {
            return root.join(self.path.trim_start_matches('/'));
        }
        root.join(format!(
            "{locale}/{}.html",
            self.path.trim_start_matches('/')
        ))
    }
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
    let mut destinations: HashSet<PathBuf> = HashSet::new();
    let mut sitemap = Vec::new();

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
                        url => Value::from_safe_string(t.canonical.clone()),
                        path => Value::from_safe_string(
                            t.canonical.strip_prefix(ORIGIN).unwrap_or("/").to_string()
                        ),
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
                canonical => Value::from_safe_string(text.canonical.clone()),
                // Passed explicitly rather than defaulted in the template because
                // UndefinedBehavior::Strict makes an absent variable a build error,
                // and that is the behaviour worth keeping.
                noindex => page.noindex,
                year => year,
                css_version => &css_v,
                og_image => Value::from_safe_string(
                    format!("{ORIGIN}/static/og/{}.png", text.slug())
                ),
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

            let dest = page.output_path(&out, locale);
            let rel = dest.strip_prefix(&out)?.to_path_buf();

            // TWO LOCALES MUST NOT LAND ON THE SAME FILE.
            //
            // `output_path` ignores the locale today, so a second locale added
            // before issue 199 gives paths their prefix would silently overwrite the
            // first: one file on disk, two entries in the sitemap, and every gate
            // green — because they all walk the route table rather than the tree.
            // check:entity is the only one that reads dist/, and it counts pages
            // against site.toml, so it would report the shortfall as a broken build
            // rather than as a collision.
            //
            // Guarded rather than remembered. The failure is silent, and this repo's
            // notes open with what silent failures have cost it.
            if !destinations.insert(rel.clone()) {
                return Err(format!(
                    "{} in {locale} would overwrite {} — paths need a locale prefix \
                 before a second locale can exist (issue 199)",
                    page.path,
                    rel.display()
                )
                .into());
            }

            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent)?;
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
            canonical => Value::from_safe_string(doc.canonical.clone()),
            noindex => doc.noindex,
            year => year,
            css_version => &css_v,
            og_image => Value::from_safe_string(format!("{ORIGIN}/static/og/index.png")),
        })?);
        fs::write(out.join(&doc.output), html)?;
        written.insert(format!("({})", doc.output), PathBuf::from(&doc.output));
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
            "  <url>\n    <loc>{loc}</loc>\n    <lastmod>{lastmod}</lastmod>\n  </url>\n"
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

    // Host configuration travels with the output. `_redirects` is not here: it
    // is generated above rather than copied, so a stale hand-edited copy in the
    // repository root cannot override the declared table.
    {
        let from = root.join("_headers");
        if from.exists() {
            fs::copy(&from, out.join("_headers"))?;
        }
    }

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
        if entry.file_type()?.is_dir() {
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
        let out =
            page("/", "https://taux.io/zh-Hant-TW").output_path(Path::new("dist"), TEST_LOCALE);
        assert_eq!(out, Path::new("dist/zh-Hant-TW.html"));
    }

    #[test]
    fn routes_become_flat_files_under_their_locale() {
        let out = page("/geo-guide", "https://taux.io/zh-Hant-TW/geo-guide")
            .output_path(Path::new("dist"), TEST_LOCALE);
        assert_eq!(out, Path::new("dist/zh-Hant-TW/geo-guide.html"));
    }

    // Nothing may land on the same file twice. The generator guards this at
    // build time too; here it is the property that guard depends on.
    #[test]
    fn two_locales_do_not_share_a_file() {
        let p = page("/geo-guide", "https://taux.io/zh-Hant-TW/geo-guide");
        assert_ne!(
            p.output_path(Path::new("dist"), "zh-Hant-TW"),
            p.output_path(Path::new("dist"), "en-US")
        );
    }

    // The host answers every unmatched path with one file, chosen before it
    // knows anything about the reader, so the error document takes no prefix.
    #[test]
    fn a_path_that_is_already_a_filename_keeps_its_name() {
        let out =
            page("/404.html", "https://taux.io/404").output_path(Path::new("dist"), TEST_LOCALE);
        assert_eq!(out, Path::new("dist/404.html"));
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
