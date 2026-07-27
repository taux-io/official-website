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

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process;
use std::process::Command;

use minijinja::value::Value;
use minijinja::{context, Environment};
use serde::Deserialize;

const ORIGIN: &str = "https://taux.io";

#[derive(Debug, Deserialize)]
struct Site {
    page: Vec<Page>,
    /// Files the host serves for a condition rather than a path. They are
    /// rendered like any page but are not routes: nothing links to them and no
    /// audit walks them as URLs.
    #[serde(default)]
    document: Vec<Document>,
}

#[derive(Debug, Deserialize)]
struct Document {
    template: String,
    output: String,
    title: String,
    description: String,
    canonical: String,
}

#[derive(Debug, Deserialize)]
struct Page {
    path: String,
    template: String,
    title: String,
    description: String,
    canonical: String,
    /// Overrides the date derived from git. Set it when a commit touched a
    /// template without changing what the page says — a class rename, a typo
    /// fix — because a modification date that moves on cosmetic edits is a
    /// freshness claim the content does not support, and search engines
    /// discount sites that make it.
    #[serde(default)]
    date_modified: Option<String>,
    /// When the page was first published. A fact, so it is written by hand.
    date_published: Option<String>,
}

impl Page {
    /// The slug the share card is filed under, derived from the canonical URL
    /// exactly as the card builder derives it. Deriving it from the route
    /// instead is how a page once advertised an image that was never generated.
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

    /// Where the file has to land for the host to serve it at `path` without a
    /// visible .html. Every one of these URLs is already indexed, so none of
    /// them may change.
    ///
    /// Flat files, not directories. `geo-guide/index.html` is served at
    /// `/geo-guide/`, and a request for `/geo-guide` is answered with a 308 to
    /// the trailing-slash form — a redirect hop on every indexed URL, and a
    /// canonical tag pointing somewhere the host will not serve directly.
    /// `geo-guide.html` is served at `/geo-guide` with no redirect at all.
    fn output_path(&self, root: &Path) -> PathBuf {
        if self.path == "/" {
            return root.join("index.html");
        }
        // Error documents keep their literal name; the host maps status codes
        // to them by filename.
        if self.path.ends_with(".html") {
            return root.join(self.path.trim_start_matches('/'));
        }
        root.join(format!("{}.html", self.path.trim_start_matches('/')))
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

    // A fresh tree each run, so a page removed from site.toml stops being
    // published rather than lingering as an orphan the audits never visit.
    if out.exists() {
        fs::remove_dir_all(&out)?;
    }
    fs::create_dir_all(&out)?;

    let year = current_year();
    let mut written = BTreeMap::new();
    let mut sitemap = Vec::new();

    for page in &site.page {
        // Every page declared its own dateModified by hand, and every one of
        // them was wrong: all six carried a date from April or May while the
        // content had been rewritten that day, and four contradicted the
        // sitemap's own lastmod for the same URL. Deriving it from the commit
        // that last touched the template makes it correct by construction.
        let modified = page
            .date_modified
            .clone()
            .or_else(|| last_commit_date(&root.join("templates").join(&page.template)))
            .unwrap_or_else(|| format!("{year}-01-01"));

        let tmpl = env.get_template(&page.template)?;
        // Titles and descriptions are escaped — one of them contains an
        // ampersand. The two URLs are not: they are ours, from site.toml, and
        // minijinja's HTML escaper turns every slash into &#x2f;, which is
        // decoded correctly by parsers but is noise no reader should be served.
        let html = tmpl.render(context! {
            title => &page.title,
            description => &page.description,
            canonical => Value::from_safe_string(page.canonical.clone()),
            year => year,
            og_image => Value::from_safe_string(
                format!("{ORIGIN}/static/og/{}.png", page.slug())
            ),
            date_modified => &modified,
            date_published => page.date_published.as_deref().unwrap_or(&modified),
        })?;
        let html = strip_comments(&html);

        sitemap.push((page.canonical.clone(), modified.clone()));

        let dest = page.output_path(&out);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&dest, html)?;
        written.insert(page.path.clone(), dest.strip_prefix(&out)?.to_path_buf());
    }

    for doc in &site.document {
        let tmpl = env.get_template(&doc.template)?;
        let html = strip_comments(&tmpl.render(context! {
            title => &doc.title,
            description => &doc.description,
            canonical => Value::from_safe_string(doc.canonical.clone()),
            year => year,
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

    copy_tree(&root.join("static"), &out.join("static"))?;

    // Host configuration travels with the output.
    for name in ["_headers", "_redirects"] {
        let from = root.join(name);
        if from.exists() {
            fs::copy(&from, out.join(name))?;
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

/// The date of the last commit that touched a file, as YYYY-MM-DD.
///
/// Returns None outside a repository or for a file git does not know, in which
/// case the caller falls back rather than inventing a date.
fn last_commit_date(path: &Path) -> Option<String> {
    let out = Command::new("git")
        .args(["log", "-1", "--format=%ad", "--date=short", "--"])
        .arg(path)
        .output()
        .ok()?;
    let s = String::from_utf8(out.stdout).ok()?;
    let s = s.trim();
    if s.is_empty() {
        None
    } else {
        Some(s.to_string())
    }
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
