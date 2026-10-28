// Word Search BD - pure puzzle logic (no DOM). Testable under node.
// All words are uppercase A-Z. Grid cells hold single letters.
(function (root) {
  'use strict';

  // Deterministic PRNG (mulberry32) so tests can reproduce a puzzle.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 8 compass directions: [dr, dc].
  var DIRS = {
    E: [0, 1], W: [0, -1], S: [1, 0], N: [-1, 0],
    SE: [1, 1], SW: [1, -1], NE: [-1, 1], NW: [-1, -1]
  };

  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function emptyGrid(size) {
    var g = [];
    for (var r = 0; r < size; r++) { g.push(new Array(size).fill('')); }
    return g;
  }

  function canPlace(grid, word, r, c, dr, dc) {
    var size = grid.length;
    var er = r + dr * (word.length - 1);
    var ec = c + dc * (word.length - 1);
    if (er < 0 || er >= size || ec < 0 || ec >= size) return false;
    for (var i = 0; i < word.length; i++) {
      var cell = grid[r + dr * i][c + dc * i];
      if (cell !== '' && cell !== word[i]) return false;
    }
    return true;
  }

  // Place as many of `words` as fit (tried in shuffled order).
  // Returns { grid, placements } where grid is fully filled with letters.
  // placements: [{ word, cells: [[r,c],...], dir }]
  function placeWords(words, size, allowedDirs, rng) {
    var grid = emptyGrid(size);
    var placements = [];
    var order = shuffle(words, rng);
    order.forEach(function (word) {
      if (word.length > size) return;
      for (var attempt = 0; attempt < 300; attempt++) {
        var dir = allowedDirs[Math.floor(rng() * allowedDirs.length)];
        var d = DIRS[dir];
        var r = Math.floor(rng() * size);
        var c = Math.floor(rng() * size);
        if (!canPlace(grid, word, r, c, d[0], d[1])) continue;
        var cells = [];
        for (var i = 0; i < word.length; i++) {
          var rr = r + d[0] * i, cc = c + d[1] * i;
          grid[rr][cc] = word[i];
          cells.push([rr, cc]);
        }
        placements.push({ word: word, cells: cells, dir: dir });
        break;
      }
    });
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (var r2 = 0; r2 < size; r2++) {
      for (var c2 = 0; c2 < size; c2++) {
        if (grid[r2][c2] === '') grid[r2][c2] = letters[Math.floor(rng() * 26)];
      }
    }
    return { grid: grid, placements: placements };
  }

  // Cells on the straight segment from (r1,c1) to (r2,c2), or null
  // when the segment is not horizontal, vertical, or 45-degree diagonal.
  // A single cell is a valid (length-1) segment.
  function cellsBetween(r1, c1, r2, c2) {
    var dr = r2 - r1, dc = c2 - c1;
    if (dr === 0 && dc === 0) return [[r1, c1]];
    var steps = Math.max(Math.abs(dr), Math.abs(dc));
    if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return null;
    var sr = dr === 0 ? 0 : dr / steps;
    var sc = dc === 0 ? 0 : dc / steps;
    var cells = [];
    for (var i = 0; i <= steps; i++) cells.push([r1 + sr * i, c1 + sc * i]);
    return cells;
  }

  function cellsKey(cells) {
    return cells.map(function (p) { return p[0] + ',' + p[1]; }).sort().join('|');
  }

  // Returns the placement whose cell set equals `cells` (either reading
  // direction), or null. `foundWords` is a Set of already-found words.
  function findPlacement(placements, cells, foundWords) {
    if (!cells || cells.length < 3) return null;
    var key = cellsKey(cells);
    for (var i = 0; i < placements.length; i++) {
      var p = placements[i];
      if (foundWords && foundWords.has(p.word)) continue;
      if (cellsKey(p.cells) === key) return p;
    }
    return null;
  }

  function formatTime(totalSeconds) {
    var m = Math.floor(totalSeconds / 60);
    var s = totalSeconds % 60;
    return (m < 10 ? '0' + m : '' + m) + ':' + (s < 10 ? '0' + s : '' + s);
  }

  var api = {
    mulberry32: mulberry32, DIRS: DIRS, shuffle: shuffle,
    canPlace: canPlace, placeWords: placeWords,
    cellsBetween: cellsBetween, cellsKey: cellsKey,
    findPlacement: findPlacement, formatTime: formatTime
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.WordSearchLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
