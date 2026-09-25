// Helpers every gate that reads built HTML shares, so that one of them cannot be
// stricter than another about the same markup.

// EVERY JSON-LD BLOCK IN A DOCUMENT, OR A THROW.
//
// check:jsonld and check:entity each matched the literal
// `<script type="application/ld+json">`, while i18n-extract accepted any
// attributes around the type. A block that gained one — a `nonce`, a reordered
// attribute, single quotes — would have been skipped by both structured-data
// gates and reported green: the gate that exists to read the block would not
// have seen it. The pattern is now the permissive one, and a document that
// mentions the type more often than the pattern matched is an error rather than
// a quiet shortfall.
const LD = /<script\b[^>]*\btype\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;
const LD_OPEN = /<script\b[^>]*application\/ld\+json/gi;

function jsonLdBlocks(html, where = "document") {
  const bodies = [...html.matchAll(LD)].map((m) => m[1]);
  const opened = (html.match(LD_OPEN) || []).length;
  if (opened !== bodies.length) {
    throw new Error(
      `${where}: ${opened} JSON-LD script tags but ${bodies.length} could be read — ` +
        `the extraction pattern no longer matches the markup`
    );
  }
  return bodies;
}

module.exports = { jsonLdBlocks };
