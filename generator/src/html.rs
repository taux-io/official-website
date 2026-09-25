//! Passes over rendered markup: escaping for attributes and XML text, and
//! stripping the comments nobody reading the page is meant to see.

use minijinja::value::Value;

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
pub(crate) fn escape_markup(raw: &str) -> String {
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
pub(crate) fn url_attr(raw: &str) -> Value {
    Value::from_safe_string(escape_markup(raw))
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
pub(crate) fn strip_comments(html: &str) -> String {
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

#[cfg(test)]
mod tests {
    use super::*;

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
