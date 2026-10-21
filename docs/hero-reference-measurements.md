> Moved from a scratch directory into the repo on 2026-10-21. The scripts and images it names (grid.py, comps.py, poster_t*.png, crop_*.png ...) were **not** moved and are not in the repo; the numbers are what was measured then, not a rerunnable test.
> Subject: the two demo videos (light, dark) of stackedlol/ascii-sharks. That repo has no licence; this file records measured numbers and observations only, none of its code. See the inspiration note in `NOTES.md` ("資產").

# Shark ASCII reference: measurements (LIGHT clip, dark used for cross-check)
Method: ffmpeg raw RGB + pure-python (no numpy). Light clip 1944x1760, 24.5 s, 1411 frames, VFR ~57.5 fps (17 ms steps, some 25 ms; NOT true 120 fps). Dark clip 1988x1734, 26.05 s.
Scripts/data in this dir: grid.py grid2.py tiles2.py comps.py track.py speed.py undul.py dust.py; frames poster_t*.png, crop_*.png, montage.png.

## 1 Grid
- Cell pitch 16 px wide x 24 px tall (vertical lines at x=11+16k, horizontal at y=1+24k; 1 px lines). Same 16 px pitch in dark clip (different viewport width) => cell is a fixed pixel size, not a fraction of viewport.
- Visible grid ~121.5 x 73.3 cells (120 x 72 full). Cell = 0.82% of viewport width (16/1944), 1.36% of height. Aspect 2:3.
- Glyph ink ~9 x 15 px inside the 16x24 cell (eyeball from 2x crops; font-size ~22-26 px, monospace, ~0.6 aspect). Low confidence on font size.
- Paper #fdfdfd (252-253). Grid line ~#f0f0f0-#f4f4f4 (240-244): ~ -9..-12 levels = black at ~4-5% alpha. Dark clip: bg ~#000-010101, lines ~ 10-12 (white ~4%).
## 2 Sharks
- Visible sharks per 0.1 s frame (connected tile clusters >=15 cells, UI excluded): min 1, median 3, max 4 (2:68, 3:118, 4:56 of 245 frames). Many partially off-screen; they enter/exit across all four edges.
- Shapes: hammerhead from above (T head, two-lobe tail), longer curved/bent body shown in C/S postures, diagonal orientations. Two colourways: cool blue-grey tiles and warm sepia/brown tiles. 
- Fully visible clusters: major axis median 26 cells (p10 16, p90 37, max 47) = 415 px = ~0.21 of viewport width (p90 0.30). Tile cells per shark median 93 (p10 58, p90 200, max 251). Cluster size shrinks when parts sit under halo (faded) so true length ~30 cells typical.
## 3 Motion
- Speed (20 fps tracks, 1 s windows, centroid): median 6.5 cells/s (range 3.3-8.1) = 104 px/s = 0.054 viewport-widths/s. ~12-18 s to cross screen.
- Paths are smooth arcs, turning about 2-20 deg/s (typ ~10), any direction incl. diagonals; no loop/wrap observed, they leave via an edge and others enter. Tracks lasted up to 8 s.
- Glyph updates: no stepped rate found; in a shark region ~7% of cells change mean brightness each 16 ms frame; no periodic bursts except video keyframe-like spikes ~1/s (encoder). So updates look per-frame (continuous), confidence medium.
- Undulation: weak signal; tail lateral offset ~0.5-1 cell amplitude, autocorr period ~1 s on one shark (LOW confidence). Visible body curvature changes slowly.
- Dust twinkle: marks persist 84% over 2 frames (33 ms), 47% over 0.2 s, 28% over 1 s; best-shift test = zero offset => they flicker in place (lifetime ~0.3-0.5 s), do not drift.
## 4 Glyphs (visual, 2x crops; no OCR)
Seen: @ 8 % # S X t ; : , ' ` . o ! and '-' (dust). Darkest tile/densest: @ 8 %; mid: # S X t; light: ; : , ' ` . Lightest/sparsest isolated cells: ' ` . , and '-' (no tile). Order dark->light approx "@8%#SXt;:,'.`". Medium confidence.
## 5 Tiles (25 frames at 1/s, ~338 tile cells/frame outside UI; tiles lighter than 226 lum excluded by detector)
- Tile lum: p1 32, p5 80, p25 111, median 132, p75 166, p95 216, max ~235 (fading into paper). Darkest ~ (33,36,37); dominant mode lum 100-130 ~ (112,113,114); light ~(215,214,212). Neutral/cool slate, tile sat median 0.065. Warm sepia group ~ (87,82,71) for brown sharks.
- Glyph colour on neutral cells: near white (lum ~225-235) on tiles 30-170, ~195 on pale tiles.
- Tinted glyphs (colour of glyph, tile stays grey): sat>0.15 & chroma>=30: 15% of tile cells; chroma>=40: 10%; >=60: 5%. Tints, share of tinted cells with typical RGB (brightest examples): amber/orange 27% (172,90,55); olive-yellow 17% (116,100,41); indigo/blue 13% (122,111,217); purple 9% (175,91,224); red/pink 7% (212,98,120); green 6-5% (30,129,59)/(53,143,42); teal 4% (134,211,203); rose 4% (229,115,160).
## 6 Dust
- Tile-less dark marks per screen: 93-205, median ~140 (dash-like '-' about 40-160, median ~100); also ' ` . , specks beside sharks. Dense patches left/right of the halo, sparse top. Flicker in place, no drift (see 3).
## 7 Halo
- Not a white wash but a soft grey veil (backdrop shadow): centre ~ (972, 880) px. Lum 223-225 at centre vs paper 252-253 (-28 levels, ~11% black), ~228-238 along the input row; fades to paper over a ~Gaussian: horizontal extent ~x 200-1650 (~1450 px = 75% W), vertical ~y 450-1300 (~850 px = 48% H). Grid lines vanish inside it.
- Sharks under it: tile median lum 188 vs 165 outside (lighter ~23), fading toward the centre; under the input box (frosted glass, strong blur ~20-30 px) sharks become a grey unreadable smudge; headline sits on top, unaffected.
## 8 Loop
- First vs last frame PSNR 18.4 dB, different shark positions: NOT a seamless loop; one continuous run, ~24.5 s. Loop would need to be built (or use a stateful sim).
## 9 Posters (light clip, left 45% ~ cols 0-53 minus UI)
Strictly empty-left frames don't exist (left tile cells never <16 while right >=150). Best: t=9.9 s (left 16 tiles, right 156), t=14.7 s (32/182, hammerhead upper right), t=8.9 s (56/201). Files: poster_t9.9.png, poster_t14.7.png, poster_t8.9.png (full frames), posters.png (side by side). Left bits are small fragments + dust; mask or crop if needed.
## Not measured
Exact font/size, OCR of glyph->brightness mapping, reliable undulation period, DPR (cell may be 8x12 CSS px at 2x).
