// Node unit tests for Word Search BD logic + word bank integrity.
// Usage: node tests/unit.test.mjs -- exits non-zero on any failure.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const L = require('../js/logic.js');
const dir = path.dirname(fileURLToPath(import.meta.url));

// words.js / i18n.js attach to globalThis when loaded outside a browser.
globalThis.window = globalThis;
await import('../js/words.js');
await import('../js/i18n.js');
const CATS = globalThis.WordSearchWords.categories;

let failures = 0;
function check(name, cond, extra) {
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}

// --- cellsBetween ---
check('horizontal segment', JSON.stringify(L.cellsBetween(2, 1, 2, 4)) === JSON.stringify([[2, 1], [2, 2], [2, 3], [2, 4]]));
check('vertical segment reversed', JSON.stringify(L.cellsBetween(4, 3, 1, 3)) === JSON.stringify([[4, 3], [3, 3], [2, 3], [1, 3]]));
check('diagonal segment', JSON.stringify(L.cellsBetween(0, 0, 2, 2)) === JSON.stringify([[0, 0], [1, 1], [2, 2]]));
check('anti-diagonal segment', JSON.stringify(L.cellsBetween(0, 4, 2, 2)) === JSON.stringify([[0, 4], [1, 3], [2, 2]]));
check('single cell', JSON.stringify(L.cellsBetween(3, 3, 3, 3)) === JSON.stringify([[3, 3]]));
check('knight move is null', L.cellsBetween(0, 0, 1, 2) === null);
check('non-45 slope is null', L.cellsBetween(0, 0, 2, 3) === null);

// --- formatTime ---
check('format 0 -> 00:00', L.formatTime(0) === '00:00');
check('format 65 -> 01:05', L.formatTime(65) === '01:05');
check('format 600 -> 10:00', L.formatTime(600) === '10:00');

// --- placeWords: seeded determinism + integrity ---
const words = ['TIGER', 'MANGO', 'DHAKA', 'CHESS'];
const r1 = L.placeWords(words, 10, ['E', 'W', 'S', 'N', 'SE', 'SW', 'NE', 'NW'], L.mulberry32(42));
const r2 = L.placeWords(words, 10, ['E', 'W', 'S', 'N', 'SE', 'SW', 'NE', 'NW'], L.mulberry32(42));
check('seeded placement is deterministic', JSON.stringify(r1.grid) === JSON.stringify(r2.grid));
check('all 4 words placed', r1.placements.length === 4);
let gridOk = true;
for (const p of r1.placements) {
  for (let i = 0; i < p.word.length; i++) {
    if (r1.grid[p.cells[i][0]][p.cells[i][1]] !== p.word[i]) gridOk = false;
  }
  for (const [r, c] of p.cells) if (r < 0 || r >= 10 || c < 0 || c >= 10) gridOk = false;
}
check('grid letters match every placement, in bounds', gridOk);
check('grid fully filled, A-Z only', r1.grid.flat().every((ch) => /^[A-Z]$/.test(ch)));
const small = L.placeWords(['TOOLONGWORDXX'], 8, ['E'], L.mulberry32(7));
check('word longer than grid is skipped', small.placements.length === 0);
const easy = L.placeWords(['TIGER', 'MANGO'], 8, ['E', 'W', 'S', 'N'], L.mulberry32(3));
check('easy dirs only: no diagonal placement', easy.placements.every((p) => ['E', 'W', 'S', 'N'].includes(p.dir)));

// --- findPlacement ---
const placements = r1.placements;
const first = placements[0];
check('forward selection matches', L.findPlacement(placements, first.cells, new Set()) === first);
check('reversed selection matches', L.findPlacement(placements, first.cells.slice().reverse(), new Set()) === first);
check('already-found word is excluded', L.findPlacement(placements, first.cells, new Set([first.word])) === null);
check('2-letter selection never matches', L.findPlacement(placements, [[0, 0], [0, 1]], new Set()) === null);
check('random cells do not match', L.findPlacement(placements, [[0, 0], [0, 1], [0, 2]], new Set()) === null ||
  placements.some((p) => L.cellsKey(p.cells) === '0,0|0,1|0,2'));

// --- word bank integrity ---
const catNames = Object.keys(CATS);
check('6 categories', catNames.length === 6, catNames.join(','));
let bankOk = true, bankDetail = '';
for (const [name, cat] of Object.entries(CATS)) {
  const seen = new Set();
  for (const [w, meaning] of cat.words) {
    if (!/^[A-Z]{3,12}$/.test(w)) { bankOk = false; bankDetail = name + ' bad word ' + w; }
    if (seen.has(w)) { bankOk = false; bankDetail = name + ' dup ' + w; }
    seen.add(w);
    if (!meaning || meaning.length < 1) { bankOk = false; bankDetail = name + ' missing meaning for ' + w; }
  }
  if (cat.words.length < 12) { bankOk = false; bankDetail = name + ' only ' + cat.words.length + ' words'; }
  const easyFits = cat.words.filter(([w]) => w.length <= 8).length;
  if (easyFits < 6) { bankOk = false; bankDetail = name + ' only ' + easyFits + ' easy-size words'; }
}
check('word bank: 6 cats, A-Z 3-12, unique, meanings, >=12 each, >=6 easy-size', bankOk, bankDetail);
const totalWords = catNames.reduce((n, k) => n + CATS[k].words.length, 0);
console.log('word bank total: ' + totalWords + ' words');
check('i18n has all keys used by app', ['title', 'subtitle', 'category', 'difficulty', 'easy', 'medium', 'hard', 'newPuzzle', 'hint', 'score', 'found', 'time', 'best', 'wordsToFind', 'dragHint', 'winTitle', 'playAgain', 'footer', 'noHint', 'hintsLeft'].every((k) => globalThis.WordSearchI18n[k] && globalThis.WordSearchI18n[k].length === 2));

// --- source hygiene: pure ASCII in shipped sources ---
let asciiOk = true;
for (const f of ['index.html', 'css/style.css', 'js/logic.js', 'js/words.js', 'js/i18n.js', 'js/app.js']) {
  const buf = fs.readFileSync(path.join(dir, '..', f));
  if (/[^\x00-\x7F]/.test(buf.toString('utf8'))) { asciiOk = false; console.log('non-ASCII in ' + f); }
}
check('shipped sources are pure ASCII (Bengali as escapes)', asciiOk);

console.log(failures === 0 ? 'unit: ALL PASS' : `unit: ${failures} FAILURES`);
process.exit(failures ? 1 : 0);
