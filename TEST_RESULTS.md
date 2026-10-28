# TEST RESULTS — Word Search BD (factory run, 2026-10-28 17:00 slot)

## Unit tests — 25/25 PASS (node tests/unit.test.mjs, 0 repairs)

- cellsBetween: horizontal, vertical-reversed, diagonal, anti-diagonal,
  single cell, knight-move null, non-45 slope null.
- formatTime: 0 -> 00:00, 65 -> 01:05, 600 -> 10:00.
- placeWords (seed 42, deterministic across runs): all 4 words placed,
  grid letters match placements, all cells in bounds, grid fully filled
  A-Z only, over-long word skipped, easy difficulty never places diagonal.
- findPlacement: forward match, reversed match, already-found excluded,
  2-letter selection never matches, random cells do not match (or match a
  real placement, guarded).
- Word bank: 6 categories, 87 words total, all A-Z 3-12 letters, unique
  within category, every word has a Bangla meaning, >=12 words per category,
  >=6 easy-size (<=8) words per category.
- i18n: all 20 keys used by the app present with [EN, BN] pairs.
- Hygiene: all shipped sources pure ASCII (Bengali emitted as \uXXXX
  escapes via a /tmp generator; grep -P zero matches).

## Smoke tests — 16/16 PASS (headless Chromium, raw CDP, 0 repairs)

- Title, default medium 10x10 grid (100 cells), 8 words listed, all
  controls present, score 0 / found 0/8 at start.
- A listed word was brute-force located in the rendered grid and a real
  pointer drag-select across its cells marked it found: found 1/8, score
  = word length x 10, list item struck through.
- Hint button flashes exactly one cell.
- Lang toggle switches the title and renders the score in Bengali digits;
  toggling back restores English.
- New puzzle regenerates the grid (letter string differs) and resets
  found to 0/8.
- Easy difficulty renders 8x8 (64 cells) with 6 words.
- 390px mobile: no horizontal overflow.
- Zero console/page errors throughout.

## Notes

- No app bugs found in either suite; no repair cycles used.
- Bengali strings in the shipped JS are \uXXXX escapes only; the generator
  source lived in /tmp and is not shipped, so the repo contains no raw
  non-ASCII bytes.
