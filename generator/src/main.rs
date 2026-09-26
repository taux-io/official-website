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

mod html;
mod markdown;
mod site;

use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process;

use minijinja::value::Value;
use minijinja::{context, Environment, UndefinedBehavior};

use html::{escape_markup, strip_comments, url_attr};
use markdown::markdown_body;
use site::Site;

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
///
/// The scripts under static/js/ get the same treatment (`js_version`): they
/// carried hand-written `?v=1` and `?v=8`, the exact bet this replaced for the
/// stylesheet. With every asset query derived from its bytes, `_headers` can
/// cache both directories as immutable.
fn content_version(file: &Path) -> Result<String, std::io::Error> {
    let bytes = fs::read(file)?;
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for b in bytes {
        hash ^= u64::from(b);
        hash = hash.wrapping_mul(0x1000_0000_01b3);
    }
    Ok(format!("{hash:016x}"))
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

fn main() {
    if let Err(e) = run() {
        eprintln!("generate: {e}");
        process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let root = std::env::current_dir()?;
    let out = root.join("dist");

    let mut site: Site = toml::from_str(&fs::read_to_string(root.join("site.toml"))?)?;
    site.derive();

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
    let css_v = content_version(&root.join("static").join("css").join("styles.min.css"))?;
    // Keyed by file name, so a template writes `?v={{ js_version["script.js"] }}`
    // and a misspelt name fails the build under strict undefined behaviour.
    let mut js_v = BTreeMap::new();
    for entry in fs::read_dir(root.join("static").join("js"))? {
        let path = entry?.path();
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            js_v.insert(name.to_string(), content_version(&path)?);
        }
    }
    let mut written = BTreeMap::new();
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

    // The menu's service columns and the insights index, once per locale —
    // generated from each page's `section` (see `Site::nav_for`).
    let mut nav: BTreeMap<String, (Value, Value)> = BTreeMap::new();
    for l in &site.locale {
        let (columns, articles) = site.nav_for(&l.tag)?;
        nav.insert(
            l.tag.clone(),
            (
                Value::from_serialize(&columns),
                Value::from_serialize(&articles),
            ),
        );
    }

    let inputs = Inputs {
        site: &site,
        nav: &nav,
        env: &env,
        out: &out,
        site_locales: &site_locales,
        year,
        css_v: &css_v,
        js_v: &js_v,
    };
    let markdown_written = render_pages(&inputs, &mut destinations, &mut written, &mut sitemap)?;
    render_documents(&inputs, &mut destinations, &mut written)?;
    write_sitemap(&out, &sitemap)?;
    write_redirects(&out, &site)?;
    copy_static(&root, &out)?;

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

/// What every render reads and none of them changes, gathered once in `run`.
#[derive(Clone, Copy)]
struct Inputs<'a, 'env> {
    site: &'a Site,
    nav: &'a BTreeMap<String, (Value, Value)>,
    env: &'a Environment<'env>,
    out: &'a Path,
    site_locales: &'a [&'a str],
    year: i32,
    css_v: &'a str,
    js_v: &'a BTreeMap<String, String>,
}

/// Every `[[page]]` in every locale it declares, with its Markdown twin.
/// Returns how many twins were written.
fn render_pages(
    inputs: &Inputs,
    destinations: &mut HashSet<PathBuf>,
    written: &mut BTreeMap<String, PathBuf>,
    sitemap: &mut Vec<(String, String)>,
) -> Result<usize, Box<dyn std::error::Error>> {
    let Inputs {
        site,
        nav,
        env,
        out,
        site_locales,
        year,
        css_v,
        js_v,
    } = *inputs;
    let mut markdown_written = 0usize;
    for page in &site.page {
        if page.locale.is_empty() {
            return Err(format!("{} declares no locale", page.path).into());
        }
        // A route is a path, not a filename. Error documents are `[[document]]`
        // rows with their own output; a `[[page]]` ending in `.html` would land
        // at `<locale>/x.html.html`. The generator used to carry a layout for
        // it that no config reached, so it is refused rather than supported.
        if page.path.ends_with(".html") {
            return Err(format!(
                "{} ends in .html — a [[page]] path is a route; error documents are [[document]]s",
                page.path
            )
            .into());
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
            // Built in Rust and handed over as a safe string, never interpolated
            // into JSON in a template — see `LocaleText::breadcrumb`.
            let breadcrumb = match &text.crumb {
                None => None,
                Some(_) => {
                    let home = site
                        .locale
                        .iter()
                        .find(|l| &l.tag == locale)
                        .and_then(|l| l.strings.get("nav_home"))
                        .ok_or_else(|| {
                            format!(
                                "{} in {locale} declares a crumb, but the locale has no nav_home string",
                                page.path
                            )
                        })?;
                    text.breadcrumb(locale, home)
                }
            };
            // Variables that exist only for some routes. Absent rather than
            // empty, so a template that wants one fails loudly under the strict
            // undefined behaviour set above. (`context!` takes one `..` merge,
            // so the two are combined here.)
            let dated = match &page.date_published {
                Some(d) => context! { date_published => d },
                None => context! {},
            };
            let optional = match &breadcrumb {
                Some(b) => context! { breadcrumb => Value::from_safe_string(b.clone()), ..dated },
                None => dated,
            };
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
                js_version => &js_v,
                nav => &nav[locale.as_str()].0,
                articles => &nav[locale.as_str()].1,
                og_image => url_attr(&format!("{ORIGIN}/static/og/{}.png", text.slug())),
                date_modified => &page.date_modified,
                ..optional
            })?;
            let html = strip_comments(&html);

            // A noindex page asks to be left out of an index; listing it in the
            // sitemap asks for the opposite. No page sets the flag today — the
            // Markdown twin already refuses it, and the sitemap now agrees.
            if !page.noindex {
                sitemap.push((text.canonical.clone(), page.date_modified.clone()));
            }

            let dest = contained(out, &page.relative_output(locale))?;
            let rel = dest.strip_prefix(out)?.to_path_buf();

            // TWO LOCALES MUST NOT LAND ON THE SAME FILE.
            //
            // `relative_output` takes the locale now (issue 199 gave every path its
            // prefix), so the collision this guards against is no longer one
            // locale away — it takes a mistake in the layout rules to produce.
            // The rules are not obvious enough to trust: a locale home is a flat
            // `<locale>.html` rather than a directory index, so a route named
            // after a locale tag and that locale's home would meet on one file.
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
                 file; see Page::relative_output for the layouts it picks between",
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
                let dest_md = contained(out, &rel_md)?;
                let rel_md = dest_md.strip_prefix(out)?.to_path_buf();

                // WHAT THIS ACTUALLY BUYS, which is narrower than the guard
                // it copies. A `.md` path is the `.html` path with its suffix
                // swapped, so two locales cannot collide here without having
                // collided above first — that case is already loud. The one it
                // catches on its own is a `[[document]]` whose `output` names a
                // `.md`: documents share this set, are written by a different
                // loop, and would otherwise overwrite a page's twin silently.
                //
                // It is the third copy of this block (the others guard the
                // page and document HTML). Left as a copy rather than extracted, because the other two are not
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
    Ok(markdown_written)
}

/// Every `[[document]]`, rendered in the canonical locale.
fn render_documents(
    inputs: &Inputs,
    destinations: &mut HashSet<PathBuf>,
    written: &mut BTreeMap<String, PathBuf>,
) -> Result<(), Box<dyn std::error::Error>> {
    let Inputs {
        site,
        nav,
        env,
        out,
        site_locales,
        year,
        css_v,
        js_v,
    } = *inputs;
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
            js_version => &js_v,
            nav => &nav[CANONICAL_LOCALE].0,
            articles => &nav[CANONICAL_LOCALE].1,
            // The canonical locale's home card. This pointed at `og/index.png`,
            // a file build-og.js has never produced — the cards are named by
            // slug, and the home slug is the locale tag.
            og_image => url_attr(&format!("{ORIGIN}/static/og/{CANONICAL_LOCALE}.png")),
        })?);
        // VETTED AND COLLISION-CHECKED EXACTLY LIKE A PAGE. It was neither.
        //
        // `out.join(&doc.output)` wrote wherever the string pointed — outside
        // dist/, or on top of a tracked file in the repository, so an ordinary
        // `npm run build:site` could mutate its own inputs. And documents never
        // entered `destinations`, so a document could silently replace a page
        // `render_pages` had just written, with the build still reporting both.
        let dest = contained(out, &doc.output)?;
        let rel = dest.strip_prefix(out)?.to_path_buf();
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
    Ok(())
}

fn write_sitemap(
    out: &Path,
    sitemap: &[(String, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    // Generated from the same table and the same dates as the pages, so a URL
    // cannot be missing from it and its lastmod cannot disagree with the
    // structured data — both of which were true of the file it replaces.
    let mut xml = String::from(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
         <urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n",
    );
    for (loc, lastmod) in sitemap {
        xml.push_str(&format!(
            "  <url>\n    <loc>{}</loc>\n    <lastmod>{}</lastmod>\n  </url>\n",
            escape_markup(loc),
            escape_markup(lastmod)
        ));
    }
    xml.push_str("</urlset>\n");
    fs::write(out.join("sitemap.xml"), &xml)?;
    Ok(())
}

fn write_redirects(out: &Path, site: &Site) -> Result<(), Box<dyn std::error::Error>> {
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
    Ok(())
}

fn copy_static(root: &Path, out: &Path) -> Result<(), Box<dyn std::error::Error>> {
    copy_tree(&root.join("static"), &out.join("static"))?;

    // Files served at the site root. They used to live in static/ and be
    // copied twice — once with the tree, once to the root — so favicon.ico,
    // robots.txt, llms.txt and site.webmanifest each answered at two URLs and
    // `_headers` and `contract` carried rules for both. public/ is published at
    // the root only; the old /static/ URLs are [[redirect]]s in site.toml.
    //
    // Flat, and never on top of something the build wrote: a public/sitemap.xml
    // silently replacing the generated one is the collision this refuses.
    for entry in fs::read_dir(root.join("public"))? {
        let entry = entry?;
        let name = entry.file_name();
        if !entry.file_type()?.is_file() {
            return Err(format!(
                "public/{} is not a plain file — public/ is flat",
                name.to_string_lossy()
            )
            .into());
        }
        let dest = out.join(&name);
        if dest.exists() {
            return Err(format!(
                "public/{} would overwrite a file the build generated",
                name.to_string_lossy()
            )
            .into());
        }
        fs::copy(entry.path(), dest)?;
    }
    Ok(())
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
    use crate::site::tests::{page, TEST_LOCALE};

    // A `.md` path must pass the same containment check as its HTML twin, or
    // the audit that made `relative_output` return a relative path buys nothing
    // for half the files the build writes.
    #[test]
    fn markdown_paths_are_contained_too() {
        let p = page("/../escaped", "https://taux.io/x");
        let rel = p.relative_markdown(TEST_LOCALE).unwrap();
        assert!(contained(Path::new("dist"), &rel).is_err());
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

    // The guard must not cost the generator a layout it actually uses. Both
    // that `relative_output` picks between have to pass through unchanged.
    #[test]
    fn the_three_layouts_all_survive_containment() {
        for rel in [
            page("/", "https://taux.io/zh-Hant-TW").relative_output(TEST_LOCALE),
            page("/geo-guide", "https://taux.io/zh-Hant-TW/geo-guide").relative_output(TEST_LOCALE),
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
}
