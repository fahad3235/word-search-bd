// Word Search BD - DOM app: grid render, pointer selection, timer, score.
(function () {
  'use strict';
  var L = window.WordSearchLogic;
  var I18N = window.WordSearchI18n;
  var WORDS = window.WordSearchWords.categories;
  var CATS = window.WordSearchCategories;

  var DIFFS = {
    easy: { size: 8, count: 6, dirs: ['E', 'W', 'S', 'N'], label: 'easy' },
    medium: { size: 10, count: 8, dirs: ['E', 'W', 'S', 'N', 'SE', 'SW', 'NE', 'NW'], label: 'medium' },
    hard: { size: 12, count: 10, dirs: ['E', 'W', 'S', 'N', 'SE', 'SW', 'NE', 'NW'], label: 'hard' }
  };
  var BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea', '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];
  var FOUND_COLORS = ['#16a34a', '#2563eb', '#c026d3', '#ea580c', '#0891b2', '#7c3aed', '#be123c', '#65a30d', '#0f766e', '#b45309'];

  var state = {
    lang: localStorage.getItem('wsbd-lang') || 'en',
    category: 'animals', diff: 'medium',
    grid: [], placements: [], found: new Set(), foundCells: {},
    score: 0, hintsUsed: 0, selecting: false, selStart: null, selCells: [],
    startTime: 0, elapsed: 0, timerId: null, won: false,
    best: parseInt(localStorage.getItem('wsbd-best') || '0', 10) || 0
  };

  function t(key) { return I18N[key][state.lang === 'bn' ? 1 : 0]; }
  function digits(s) {
    s = String(s);
    if (state.lang !== 'bn') return s;
    return s.replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
  }
  function $(id) { return document.getElementById(id); }

  function newPuzzle() {
    var diff = DIFFS[state.diff];
    var pool = WORDS[state.category].words
      .filter(function (w) { return w[0].length <= diff.size; })
      .map(function (w) { return w[0]; });
    // Shuffle pool with Math.random, take the first `count` words.
    var shuffled = L.shuffle(pool, Math.random);
    var chosen = shuffled.slice(0, diff.count);
    var result = L.placeWords(chosen, diff.size, diff.dirs, Math.random);
    state.grid = result.grid;
    state.placements = result.placements;
    state.found = new Set();
    state.foundCells = {};
    state.score = 0;
    state.hintsUsed = 0;
    state.won = false;
    state.elapsed = 0;
    state.startTime = Date.now();
    clearInterval(state.timerId);
    state.timerId = setInterval(tick, 1000);
    renderAll();
  }

  function tick() {
    if (state.won) return;
    state.elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    $('timeVal').textContent = digits(L.formatTime(state.elapsed));
  }

  function renderAll() {
    renderGrid();
    renderWordList();
    renderStats();
    renderLabels();
  }

  function renderLabels() {
    $('title').textContent = t('title');
    $('subtitle').textContent = t('subtitle');
    $('categoryLabel').textContent = t('category');
    $('diffLabel').textContent = t('difficulty');
    $('newBtn').textContent = t('newPuzzle');
    $('hintBtn').textContent = t('hint') + ' (' + digits(3 - state.hintsUsed) + ')';
    $('scoreLabel').textContent = t('score');
    $('foundLabel').textContent = t('found');
    $('timeLabel').textContent = t('time');
    $('bestLabel').textContent = t('best');
    $('wordsHeading').textContent = t('wordsToFind');
    $('dragHint').textContent = t('dragHint');
    $('footerText').textContent = t('footer');
    $('langBtn').textContent = state.lang === 'bn' ? 'English' : '\u09ac\u09be\u0982\u09b2\u09be';
    var diffSel = $('diffSel');
    diffSel.options[0].text = t('easy');
    diffSel.options[1].text = t('medium');
    diffSel.options[2].text = t('hard');
    var catSel = $('catSel');
    Object.keys(CATS).forEach(function (key, i) {
      catSel.options[i].text = state.lang === 'bn' ? CATS[key].bn : CATS[key].en;
    });
    $('winBox').hidden = !state.won;
    if (state.won) {
      $('winTitle').textContent = t('winTitle');
      $('winText').textContent = t('score') + ': ' + digits(state.score) + '  |  ' + t('time') + ': ' + digits(L.formatTime(state.elapsed));
      $('againBtn').textContent = t('playAgain');
    }
  }

  function renderStats() {
    $('scoreVal').textContent = digits(state.score);
    $('foundVal').textContent = digits(state.found.size) + '/' + digits(state.placements.length);
    $('timeVal').textContent = digits(L.formatTime(state.elapsed));
    $('bestVal').textContent = digits(state.best);
    $('hintBtn').textContent = t('hint') + ' (' + digits(3 - state.hintsUsed) + ')';
  }

  function renderGrid() {
    var gridEl = $('grid');
    gridEl.innerHTML = '';
    gridEl.style.setProperty('--cols', state.grid.length);
    state.grid.forEach(function (row, r) {
      row.forEach(function (letter, c) {
        var cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.textContent = letter;
        var key = r + ',' + c;
        if (state.foundCells[key] !== undefined) {
          cell.classList.add('found');
          cell.style.background = FOUND_COLORS[state.foundCells[key] % FOUND_COLORS.length];
        }
        gridEl.appendChild(cell);
      });
    });
  }

  function renderWordList() {
    var list = $('wordList');
    list.innerHTML = '';
    state.placements.forEach(function (p, i) {
      var entry = WORDS[state.category].words.find(function (w) { return w[0] === p.word; });
      var li = document.createElement('li');
      li.className = state.found.has(p.word) ? 'found-word' : '';
      li.innerHTML = '';
      var wSpan = document.createElement('span');
      wSpan.className = 'wl-word';
      wSpan.textContent = p.word;
      var mSpan = document.createElement('span');
      mSpan.className = 'wl-meaning';
      mSpan.textContent = entry ? entry[1] : '';
      var dot = document.createElement('span');
      dot.className = 'wl-dot';
      dot.style.background = FOUND_COLORS[i % FOUND_COLORS.length];
      li.appendChild(dot);
      li.appendChild(wSpan);
      li.appendChild(mSpan);
      list.appendChild(li);
    });
  }

  function cellFromEvent(ev) {
    var el = document.elementFromPoint(ev.clientX, ev.clientY);
    if (el && el.classList && el.classList.contains('cell')) return el;
    if (ev.target && ev.target.classList && ev.target.classList.contains('cell')) return ev.target;
    return null;
  }

  function paintSelection() {
    document.querySelectorAll('#grid .cell.sel').forEach(function (el) { el.classList.remove('sel'); });
    state.selCells.forEach(function (p) {
      var el = document.querySelector('#grid .cell[data-r="' + p[0] + '"][data-c="' + p[1] + '"]');
      if (el) el.classList.add('sel');
    });
  }

  function onPointerDown(ev) {
    var cell = cellFromEvent(ev);
    if (!cell || state.won) return;
    ev.preventDefault();
    state.selecting = true;
    state.selStart = [+cell.dataset.r, +cell.dataset.c];
    state.selCells = [state.selStart];
    paintSelection();
  }

  function onPointerMove(ev) {
    if (!state.selecting) return;
    var cell = cellFromEvent(ev);
    if (!cell) return;
    var cells = L.cellsBetween(state.selStart[0], state.selStart[1], +cell.dataset.r, +cell.dataset.c);
    if (cells) { state.selCells = cells; paintSelection(); }
  }

  function onPointerUp() {
    if (!state.selecting) return;
    state.selecting = false;
    var hit = L.findPlacement(state.placements, state.selCells, state.found);
    document.querySelectorAll('#grid .cell.sel').forEach(function (el) { el.classList.remove('sel'); });
    if (hit) {
      state.found.add(hit.word);
      var idx = state.placements.indexOf(hit);
      hit.cells.forEach(function (p) { state.foundCells[p[0] + ',' + p[1]] = idx; });
      state.score += hit.word.length * 10;
      renderGrid();
      renderWordList();
      renderStats();
      if (state.found.size === state.placements.length) {
        state.won = true;
        clearInterval(state.timerId);
        if (state.score > state.best) {
          state.best = state.score;
          localStorage.setItem('wsbd-best', String(state.best));
        }
        renderStats();
        renderLabels();
      }
    }
    state.selCells = [];
  }

  function useHint() {
    if (state.hintsUsed >= 3) { $('hintMsg').textContent = t('noHint'); return; }
    var remaining = state.placements.filter(function (p) { return !state.found.has(p.word); });
    if (!remaining.length) return;
    state.hintsUsed++;
    var first = remaining[0].cells[0];
    var el = document.querySelector('#grid .cell[data-r="' + first[0] + '"][data-c="' + first[1] + '"]');
    if (el) {
      el.classList.add('hint-flash');
      setTimeout(function () { el.classList.remove('hint-flash'); }, 1500);
    }
    $('hintMsg').textContent = '';
    renderStats();
  }

  function init() {
    var catSel = $('catSel');
    Object.keys(CATS).forEach(function (key) {
      var opt = document.createElement('option');
      opt.value = key;
      opt.text = CATS[key].en;
      catSel.appendChild(opt);
    });
    catSel.value = state.category;
    $('diffSel').value = state.diff;
    catSel.addEventListener('change', function () { state.category = catSel.value; newPuzzle(); });
    $('diffSel').addEventListener('change', function () { state.diff = $('diffSel').value; newPuzzle(); });
    $('newBtn').addEventListener('click', newPuzzle);
    $('againBtn').addEventListener('click', newPuzzle);
    $('hintBtn').addEventListener('click', useHint);
    $('langBtn').addEventListener('click', function () {
      state.lang = state.lang === 'bn' ? 'en' : 'bn';
      localStorage.setItem('wsbd-lang', state.lang);
      renderAll();
    });
    var gridEl = $('grid');
    gridEl.addEventListener('pointerdown', onPointerDown);
    gridEl.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    newPuzzle();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
