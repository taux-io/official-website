#!/usr/bin/env python3
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'

def minify_css(css: str) -> str:
    css = re.sub(r"/\*[^*]*\*+(?:[^/*][^*]*\*+)*/", "", css)  # remove comments
    css = re.sub(r"\s+", " ", css)  # collapse whitespace
    # remove spaces around symbols
    css = re.sub(r"\s*([{};:,>])\s*", r"\1", css)
    css = css.replace(";}", "}")
    return css.strip()

def strip_block_comments(js: str) -> str:
    return re.sub(r"/\*[^*]*\*+(?:[^/*][^*]*\*+)*/", "", js)

def minify_js(js: str) -> str:
    js = strip_block_comments(js)
    # Preserve strings while trimming line whitespace
    lines = []
    for line in js.splitlines():
        # keep line comments but trim leading/trailing spaces
        s = line.strip()
        if not s:
            continue
        lines.append(s)
    # join with single newline to keep safety
    return "\n".join(lines)

def write_minified(src_path: Path, out_path: Path, kind: str):
    text = src_path.read_text(encoding='utf-8')
    if kind == 'css':
        out = minify_css(text)
    elif kind == 'js':
        out = minify_js(text)
    else:
        raise ValueError('Unknown kind')
    out_path.write_text(out, encoding='utf-8')
    print(f"Minified {src_path.name} -> {out_path.name} ({len(text)} -> {len(out)} bytes)")

def main():
    css_in = SRC / 'styles.css'
    js_in = SRC / 'script.js'
    css_out = SRC / 'styles.min.css'
    js_out = SRC / 'script.min.js'

    if css_in.exists():
        write_minified(css_in, css_out, 'css')
    else:
        print('No styles.css found')

    if js_in.exists():
        write_minified(js_in, js_out, 'js')
    else:
        print('No script.js found')

if __name__ == '__main__':
    main()

