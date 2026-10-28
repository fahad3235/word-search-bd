# Word Search BD

Offline bilingual EN/Bangla word-search puzzle game. Pick a category, pick a
difficulty, and drag across the letter grid to find every hidden word. Each
word in the list shows its Bangla meaning, so the game doubles as a
vocabulary builder.

## Features

- **Fresh puzzle every game** — words are placed by a placement engine
  (random start + direction, overlap only on matching letters), filler
  letters are random, so no two puzzles are alike.
- **6 categories, 87 words** — Animals, Bangladesh, Colours, Food, Science,
  Sports. Every word carries a Bangla meaning shown in the word list.
- **3 difficulties** — Easy (8x8, 6 words, horizontal/vertical only),
  Medium (10x10, 8 words, all 8 directions), Hard (12x12, 10 words, all 8
  directions).
- **Drag-to-select** — mouse or touch drag across letters; only straight
  lines (horizontal, vertical, 45-degree diagonal) count. Found words are
  colour-coded in the grid and struck through in the list.
- **Score + timer + best score** — 10 points per letter; best score persists
  in localStorage.
- **Hints** — 3 per puzzle; flashes the first letter of an unfound word.
- **EN/Bangla toggle** — persisted in localStorage; numbers render in
  Bengali digits in Bangla mode.
- **100% offline** — no network requests, no account, no tracking.

## Stack

Vanilla HTML/CSS/JavaScript. No build step, no dependencies. The puzzle
engine (`js/logic.js`) has no DOM code and is unit-tested under node; the
page is smoke-tested in headless Chromium over raw CDP.

## Run locally

Just open `index.html` in a browser, or serve the folder:

```sh
npx serve .
# or
python3 -m http.server 8000
```

## Testing

```sh
node tests/unit.test.mjs   # logic + word-bank integrity
node tests/smoke.js        # headless-Chrome end-to-end (drag-select, hint, i18n, mobile)
```

## Limitations

- Word meanings are short glosses, not dictionary definitions.
- The timer runs on the device clock; closing the tab pauses nothing — a
  new puzzle starts a fresh timer.
- Best score is stored per browser (localStorage), not synced.

## Status

MVP complete. Tests: 25/25 node unit checks + 16/16 headless-Chrome smoke
checks, 0 console/page errors, 390px mobile with no horizontal overflow.
