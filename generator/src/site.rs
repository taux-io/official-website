//! The site.toml data model: what a page, a document and a redirect are, and
//! what follows from them without being written down.

use std::collections::BTreeMap;

use serde::Deserialize;

use crate::markdown::yaml_scalar;
use crate::{CANONICAL_LOCALE, ORIGIN};

/// One published language.
///
/// The roster is the published set rather than a plan: the switcher and the
/// hreflang block are generated from it, so an entry with no pages behind it
/// would point readers and crawlers at a 404.
#[derive(Debug, Deserialize, Clone)]
pub(crate) struct Locale {
    pub(crate) tag: String,
    pub(crate) name: String,
    pub(crate) og: String,
    /// The writing system. Read by five things rather than by the generator;
    /// declared here so they cannot each guess it differently. (This said
    /// "three" while `check:entity`, `heading structure`, geometry's `measure`,
    /// the OG card builder and the reading-measure table all read it.)
    #[allow(dead_code)]
    pub(crate) script: String,
    /// Prose that lives in a shared template and therefore cannot be translated
    /// by writing a second file. One key today; the alternative is an inline
    /// `{% if locale == ... %}`, which is a branch per language inside a file
    /// every language reads.
    #[serde(default)]
    pub(crate) strings: BTreeMap<String, String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct Site {
    #[serde(default)]
    pub(crate) locale: Vec<Locale>,
    pub(crate) page: Vec<Page>,
    /// Files the host serves for a condition rather than a path. They are
    /// rendered like any page but are not routes: nothing links to them and no
    /// audit walks them as URLs.
    #[serde(default)]
    pub(crate) document: Vec<Document>,
    /// Paths that used to be routes and now answer a redirect.
    #[serde(default)]
    pub(crate) redirect: Vec<Redirect>,
}

impl Site {
    /// Fills in what site.toml leaves out because it follows from the rest.
    ///
    /// ONE HUNDRED CANONICALS AND EIGHTY TEMPLATES, NONE OF THEM A DECISION.
    /// Every `canonical` was `ORIGIN/<locale><path>` and every non-canonical
    /// locale's `template` was `<locale>/<route template>`, without exception —
    /// 180 hand-written lines whose only possible content was the rule, and
    /// whose only possible deviation was a typo. They are derived here, once,
    /// and `scripts/routes.js` applies the same rule for the Node side; a row
    /// that genuinely differs still says so explicitly and wins.
    pub(crate) fn derive(&mut self) {
        for page in &mut self.page {
            for (tag, text) in &mut page.locale {
                if text.canonical.is_empty() {
                    text.canonical = derived_canonical(tag, &page.path);
                }
                if text.template.is_none() && tag != CANONICAL_LOCALE {
                    text.template = Some(format!("{tag}/{}", page.template));
                }
            }
        }
    }
}

/// `https://taux.io/<locale>` for the home route, `https://taux.io/<locale><path>`
/// for every other. Mirrored by `derivedCanonical` in scripts/routes.js.
fn derived_canonical(locale: &str, path: &str) -> String {
    if path == "/" {
        format!("{ORIGIN}/{locale}")
    } else {
        format!("{ORIGIN}/{locale}{path}")
    }
}

/// A path that has been retired, and where it goes now.
///
/// Declared in site.toml rather than hand-written into `_redirects`, for the
/// reason the sitemap is generated: a hand-maintained list of URLs drifts from
/// the pages it describes, and this project has already paid for that once.
#[derive(Debug, Deserialize)]
pub(crate) struct Redirect {
    pub(crate) from: String,
    pub(crate) to: String,
    #[serde(default = "permanent")]
    pub(crate) status: u16,
}

/// A retired path is retired permanently. A 302 would tell search engines to
/// keep the old URL, which is the opposite of what a rename is for.
fn permanent() -> u16 {
    301
}

#[derive(Debug, Deserialize)]
pub(crate) struct Document {
    pub(crate) template: String,
    pub(crate) output: String,
    pub(crate) title: String,
    pub(crate) description: String,
    /// Empty suppresses both `<link rel="canonical">` and `og:url`.
    ///
    /// The 404 document is served for every unmatched path *and* is addressable
    /// at `/404`, where a static host answers 200. A self-referencing canonical
    /// on that page invites an answer engine to index "this page does not exist"
    /// as a page. It has no canonical URL because it is not a document about
    /// anything; the empty string says that.
    pub(crate) canonical: String,
    /// Emits `<meta name="robots" content="noindex, follow">`.
    ///
    /// `follow` rather than `none`: the links in the header and footer are the
    /// site's real navigation and there is no reason to stop a crawler using
    /// them just because it should not index the page it found them on.
    #[serde(default)]
    pub(crate) noindex: bool,
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
pub(crate) struct LocaleText {
    pub(crate) title: String,
    pub(crate) description: String,
    /// Derived when absent — see `Site::derive`. Written only when it differs
    /// from `ORIGIN/<locale><path>`, which today it never does.
    #[serde(default)]
    pub(crate) canonical: String,
    /// The template this language renders from, when it is not the route's.
    ///
    /// TRANSLATED PAGES NEED TRANSLATED TEMPLATES, and the route-level
    /// `template` cannot supply that: one file cannot hold two languages'
    /// prose. Without this the second locale would render the first locale's
    /// body under a translated title — a page that passes every gate, because
    /// no gate reads prose, and is wrong to every reader.
    ///
    /// Derived when absent — see `Site::derive`: the canonical locale uses the
    /// route's template, every other locale `<locale>/<template>`. Falling back
    /// to the route's template for a non-canonical locale would be exactly the
    /// failure described above, so it is never the default.
    #[serde(default)]
    pub(crate) template: Option<String>,
    /// This page's name in its breadcrumb — the second and last item; the first
    /// is the locale's home, named by its `nav_home` string.
    ///
    /// The seventy-five BreadcrumbList nodes were hand-written JSON in the
    /// templates, one per route per locale, with the URLs typed out. The names
    /// are the one part that cannot be derived — only 28 of 75 matched the
    /// start of the title — so they live here and the rest is built by
    /// `breadcrumb()`. A route without one gets no breadcrumb variable, and a
    /// template that asks for it fails the build under strict undefined.
    #[serde(default)]
    pub(crate) crumb: Option<String>,
    /// The page's name in the menu, when the breadcrumb name is too long for
    /// it. Falls back to `crumb`, then to the title's first segment.
    #[serde(default)]
    pub(crate) label: Option<String>,
}

impl LocaleText {
    /// The BreadcrumbList node for this page, serialised: home → this page.
    ///
    /// Home is `ORIGIN/<locale>`, the locale home's canonical — not `ORIGIN`,
    /// which is a 302 and which 38 of the hand-written breadcrumbs pointed at
    /// before `check:entity` started holding them to the route table.
    pub(crate) fn breadcrumb(&self, locale: &str, home_name: &str) -> Option<String> {
        let name = self.crumb.as_ref()?;
        Some(
            serde_json::json!({
                "@type": "BreadcrumbList",
                "@id": format!("{}#breadcrumb", self.canonical),
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": home_name, "item": format!("{ORIGIN}/{locale}")},
                    {"@type": "ListItem", "position": 2, "name": name, "item": self.canonical},
                ]
            })
            .to_string(),
        )
    }
}

#[derive(Debug, Deserialize)]
pub(crate) struct Page {
    pub(crate) path: String,
    pub(crate) template: String,
    /// Keyed by locale tag. A `BTreeMap` rather than a `HashMap` so the build is
    /// reproducible: the render order decides the order pages land in the
    /// sitemap, and a hash map would reshuffle it between runs.
    pub(crate) locale: BTreeMap<String, LocaleText>,
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
    pub(crate) date_modified: String,
    /// When the page was first published. A fact, so it is written by hand, and
    /// it has no default: a page whose template asks for it and whose entry does
    /// not supply it fails the build rather than borrowing another date.
    #[serde(default)]
    pub(crate) date_published: Option<String>,
    /// Where the page is listed. One of the menu's service columns — `ai`,
    /// `marketing`, `training`, `security` (`NAV_SECTIONS`) — or `article` for
    /// the insights index. Absent for pages listed by hand (home, company,
    /// legal). The menu and the index are generated from this, per locale, so
    /// a page that has not been translated into a language is not linked from
    /// that language's menu.
    #[serde(default)]
    pub(crate) section: Option<String>,
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
    pub(crate) noindex: bool,
}

impl LocaleText {
    /// The slug the share card is filed under, derived from the canonical URL
    /// exactly as the card builder derives it. Deriving it from the route
    /// instead is how a page once advertised an image that was never generated.
    ///
    /// It hangs off the locale rather than the page because the canonical is
    /// per-locale: one route, one card per language.
    pub(crate) fn slug(&self) -> String {
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
    pub(crate) fn front_matter(
        &self,
        locale: &str,
        alternates: &BTreeMap<String, String>,
    ) -> String {
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
    pub(crate) fn relative_output(&self, locale: &str) -> String {
        if self.path == "/" {
            return format!("{locale}.html");
        }
        format!("{locale}/{}.html", self.path.trim_start_matches('/'))
    }

    /// Where this route's Markdown twin lands, or `None` for a route that gets
    /// none.
    ///
    /// Derived from `relative_output` rather than rebuilt beside it. The two
    /// layouts that function picks between — a locale home is a flat file,
    /// everything else takes a locale prefix — are exactly the rules the Markdown has to obey too, and a second
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
    pub(crate) fn relative_markdown(&self, locale: &str) -> Option<String> {
        if self.noindex {
            return None;
        }
        let html = self.relative_output(locale);
        let stem = html.strip_suffix(".html")?;
        Some(format!("{stem}.md"))
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::markdown::tests::CANON;

    pub(crate) const TEST_LOCALE: &str = "zh-Hant-TW";

    pub(crate) fn page(path: &str, canonical: &str) -> Page {
        Page {
            path: path.to_string(),
            template: "t.html".to_string(),
            locale: BTreeMap::from([(TEST_LOCALE.to_string(), text(canonical))]),
            date_modified: "2026-01-01".to_string(),
            date_published: None,
            section: None,
            noindex: false,
        }
    }

    pub(crate) fn text(canonical: &str) -> LocaleText {
        LocaleText {
            title: String::new(),
            description: String::new(),
            canonical: canonical.to_string(),
            template: None,
            crumb: None,
            label: None,
        }
    }

    fn titled(title: &str, description: &str, canonical: &str) -> LocaleText {
        LocaleText {
            title: title.to_string(),
            description: description.to_string(),
            canonical: canonical.to_string(),
            template: None,
            crumb: None,
            label: None,
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

    // The derivation is the whole reason 180 lines left site.toml, so it is
    // pinned: home and non-home canonicals, the canonical locale keeping the
    // route's template, every other locale getting its own — and a row that
    // states a value keeping it.
    // The breadcrumb is data, built by serde_json: the URLs come out as URLs,
    // not autoescaped `&#x2f;`, and a quote in a name cannot break the JSON.
    #[test]
    fn a_breadcrumb_runs_from_the_locale_home_to_the_page() {
        let mut t = text("https://taux.io/ja-JP/geo-guide");
        assert_eq!(t.breadcrumb("ja-JP", "ホーム"), None);
        t.crumb = Some("GEO \"入門\"".to_string());
        let json = t.breadcrumb("ja-JP", "ホーム").unwrap();
        assert!(json.starts_with(
            r#"{"@type":"BreadcrumbList","@id":"https://taux.io/ja-JP/geo-guide#breadcrumb""#
        ));
        assert!(json.contains(r#""position":1,"name":"ホーム","item":"https://taux.io/ja-JP""#));
        assert!(json.contains(
            r#""position":2,"name":"GEO \"入門\"","item":"https://taux.io/ja-JP/geo-guide""#
        ));
        assert!(!json.contains("&#"));
    }

    // The menu is generated per locale: a page missing from a locale is not
    // listed there, an empty column is dropped, a column title comes from the
    // locale's strings, and a typo in `section` fails the build.
    #[test]
    fn the_menu_lists_only_what_a_locale_has() {
        let mut site: Site = toml::from_str(
            r#"
            [[locale]]
            tag = "zh-Hant-TW"
            name = "繁體中文"
            og = "zh_TW"
            script = "Hant"
              [locale.strings]
              nav_col_ai = "AI 導入與整合"
            [[locale]]
            tag = "en-US"
            name = "English"
            og = "en_US"
            script = "Latn"
              [locale.strings]
              nav_col_ai = "AI adoption"
            [[page]]
            path = "/mcp-integration"
            template = "mcp-integration.html"
            section = "ai"
            date_modified = "2026-01-01"
              [page.locale.zh-Hant-TW]
              title = "MCP 串接 | TauX"
              description = "d"
              label = "MCP 串接"
            [[page]]
            path = "/what-is-mcp"
            template = "what-is-mcp.html"
            section = "article"
            date_modified = "2026-01-01"
              [page.locale.zh-Hant-TW]
              title = "MCP 是什麼？ | TauX"
              description = "d"
              [page.locale.en-US]
              title = "What is MCP | TauX"
              description = "d"
            "#,
        )
        .unwrap();
        site.derive();
        let (cols, articles) = site.nav_for("zh-Hant-TW").unwrap();
        assert_eq!(cols.len(), 1);
        assert_eq!(cols[0].title, "AI 導入與整合");
        assert_eq!(cols[0].items[0].href, "/zh-Hant-TW/mcp-integration");
        assert_eq!(cols[0].items[0].label, "MCP 串接");
        assert_eq!(articles[0].label, "MCP 是什麼？");
        let (cols, articles) = site.nav_for("en-US").unwrap();
        assert!(
            cols.is_empty(),
            "the service has no en-US entry, so no column"
        );
        assert_eq!(articles[0].href, "/en-US/what-is-mcp");
        site.page[0].section = Some("sercurity".to_string());
        assert!(site.nav_for("zh-Hant-TW").is_err());
    }

    #[test]
    fn omitted_canonicals_and_templates_are_derived() {
        let mut site: Site = toml::from_str(
            r#"
            [[page]]
            path = "/"
            template = "index.html"
            date_modified = "2026-01-01"
              [page.locale.zh-Hant-TW]
              title = "t"
              description = "d"
              [page.locale.en-US]
              title = "t"
              description = "d"
            [[page]]
            path = "/geo-guide"
            template = "geo-guide.html"
            date_modified = "2026-01-01"
              [page.locale.ja-JP]
              title = "t"
              description = "d"
              [page.locale.ko-KR]
              title = "t"
              description = "d"
              canonical = "https://taux.io/ko-KR/elsewhere"
              template = "ko-KR/other.html"
            "#,
        )
        .unwrap();
        site.derive();
        let home = &site.page[0].locale;
        assert_eq!(home["zh-Hant-TW"].canonical, "https://taux.io/zh-Hant-TW");
        assert_eq!(home["zh-Hant-TW"].template, None);
        assert_eq!(home["en-US"].template.as_deref(), Some("en-US/index.html"));
        let guide = &site.page[1].locale;
        assert_eq!(guide["ja-JP"].canonical, "https://taux.io/ja-JP/geo-guide");
        assert_eq!(
            guide["ja-JP"].template.as_deref(),
            Some("ja-JP/geo-guide.html")
        );
        assert_eq!(guide["ko-KR"].canonical, "https://taux.io/ko-KR/elsewhere");
        assert_eq!(guide["ko-KR"].template.as_deref(), Some("ko-KR/other.html"));
    }
}

/// The menu's service columns, in order. Each needs a `nav_col_<key>` string in
/// every locale that lists a page under it.
pub(crate) const NAV_SECTIONS: [&str; 4] = ["ai", "marketing", "training", "security"];

#[derive(serde::Serialize)]
pub(crate) struct NavItem {
    /// `/<locale><path>`, built from site.toml — ours, so templates print it
    /// with `|safe`. Autoescape would otherwise write every `/` as `&#x2f;`:
    /// harmless to a browser, but the anchor rule and the Markdown twin's link
    /// rewriting both read the literal attribute.
    pub(crate) href: String,
    pub(crate) label: String,
    pub(crate) description: String,
}

#[derive(serde::Serialize)]
pub(crate) struct NavColumn {
    pub(crate) key: &'static str,
    pub(crate) title: String,
    pub(crate) items: Vec<NavItem>,
}

impl LocaleText {
    /// The shortest name the page has: `label`, then `crumb`, then the title
    /// up to its first `|`／`｜`.
    pub(crate) fn short_name(&self) -> String {
        if let Some(l) = self.label.as_ref().or(self.crumb.as_ref()) {
            return l.clone();
        }
        self.title
            .split(['|', '｜'])
            .next()
            .unwrap_or(&self.title)
            .trim()
            .to_string()
    }
}

impl Site {
    /// The menu's service columns and the insights index for one locale.
    ///
    /// Only pages that exist in `locale` are listed, so a service published in
    /// two languages first is simply absent from the other three menus rather
    /// than a link to a 404. An empty column is dropped.
    pub(crate) fn nav_for(&self, locale: &str) -> Result<(Vec<NavColumn>, Vec<NavItem>), String> {
        let strings = self
            .locale
            .iter()
            .find(|l| l.tag == locale)
            .map(|l| &l.strings);
        let item = |page: &Page, text: &LocaleText| NavItem {
            href: format!("/{locale}{}", page.path),
            label: text.short_name(),
            description: text.description.clone(),
        };
        for page in &self.page {
            if let Some(s) = &page.section {
                if s != "article" && !NAV_SECTIONS.contains(&s.as_str()) {
                    return Err(format!("{} has unknown section {s:?}", page.path));
                }
            }
        }
        let mut columns = Vec::new();
        for key in NAV_SECTIONS {
            let items: Vec<NavItem> = self
                .page
                .iter()
                .filter(|p| p.section.as_deref() == Some(key))
                .filter_map(|p| p.locale.get(locale).map(|t| item(p, t)))
                .collect();
            if items.is_empty() {
                continue;
            }
            let title = strings
                .and_then(|s| s.get(&format!("nav_col_{key}")))
                .ok_or_else(|| {
                    format!("{locale} lists a {key} page but has no nav_col_{key} string")
                })?
                .clone();
            columns.push(NavColumn { key, title, items });
        }
        let articles = self
            .page
            .iter()
            .filter(|p| p.section.as_deref() == Some("article"))
            .filter_map(|p| p.locale.get(locale).map(|t| item(p, t)))
            .collect();
        Ok((columns, articles))
    }
}
