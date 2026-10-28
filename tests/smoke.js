// Headless-Chrome smoke test via raw CDP (no puppeteer dependency).
// Usage: node tests/smoke.js -- exits non-zero on any failure or page error.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 9348;
const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');
let failures = 0;
const pageErrors = [];
function check(name, cond, extra) {
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function poll(fn, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if (await fn()) return true; } catch (e) { /* retry */ }
    await wait(200);
  }
  return false;
}

(async () => {
  const chrome = spawn('/opt/meta-chromium/chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/ws-smoke-' + process.pid,
    'about:blank',
  ], { stdio: 'ignore' });
  let targets = [];
  for (let i = 0; i < 50 && targets.length === 0; i++) {
    await wait(200);
    try {
      targets = JSON.parse(await new Promise((res, rej) => {
        http.get('http://127.0.0.1:' + PORT + '/json/list', (r) => {
          let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d));
        }).on('error', rej);
      }));
    } catch (e) { /* retry */ }
  }
  if (!targets.length) { console.log('FAIL - chrome did not start'); process.exit(2); }
  const wsUrl = targets[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise((res) => { ws.onopen = res; });
  let seq = 0; const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push(JSON.stringify(msg.params.args));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push(JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
    }
  };
  const send = (method, params) => new Promise((res) => {
    const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params }));
  });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    return r.result ? r.result.result.value : undefined;
  };
  await send('Page.enable', {});
  await send('Runtime.enable', {});
  await send('Page.navigate', { url: FILE });
  await poll(async () => (await ev('document.querySelectorAll("#grid .cell").length')) === 100, 10000);

  check('title is Word Search BD', (await ev('document.title')) === 'Word Search BD');
  check('default medium grid is 10x10 = 100 cells', (await ev('document.querySelectorAll("#grid .cell").length')) === 100);
  check('8 words listed for medium', (await ev('document.querySelectorAll("#wordList li").length')) === 8);
  check('controls present (category, difficulty, new, hint, lang)', await ev('!!(document.getElementById("catSel") && document.getElementById("diffSel") && document.getElementById("newBtn") && document.getElementById("hintBtn") && document.getElementById("langBtn"))'));
  check('score starts 0, found 0/8', (await ev('document.getElementById("scoreVal").textContent')) === '0' &&
    (await ev('document.getElementById("foundVal").textContent')) === '0/8');

  // Brute-force locate one listed word in the rendered grid, then drag-select it.
  const found = await ev(`(function(){
    var cells = Array.from(document.querySelectorAll('#grid .cell'));
    var size = 10, grid = [];
    cells.forEach(function(el){ var r=+el.dataset.r, c=+el.dataset.c; (grid[r] = grid[r] || [])[c] = el.textContent; });
    var words = Array.from(document.querySelectorAll('#wordList .wl-word')).map(function(el){ return el.textContent; });
    var dirs = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
    for (var wi = 0; wi < words.length; wi++) {
      var w = words[wi];
      for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) {
        for (var d = 0; d < dirs.length; d++) {
          var dr = dirs[d][0], dc = dirs[d][1];
          var er = r + dr*(w.length-1), ec = c + dc*(w.length-1);
          if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
          var ok = true;
          for (var i = 0; i < w.length; i++) if (grid[r+dr*i][c+dc*i] !== w[i]) { ok = false; break; }
          if (ok) {
            var path = [];
            for (var k = 0; k < w.length; k++) {
              var el2 = document.querySelector('#grid .cell[data-r="'+(r+dr*k)+'"][data-c="'+(c+dc*k)+'"]');
              var rect = el2.getBoundingClientRect();
              path.push([rect.left + rect.width/2, rect.top + rect.height/2]);
            }
            return { word: w, path: path };
          }
        }
      }
    }
    return null;
  })()`);
  check('a listed word is locatable in the grid', !!found, JSON.stringify(found && found.word));
  if (found) {
    const dragOk = await ev(`(function(){
      var path = ${JSON.stringify(found.path)};
      function cellAt(x, y){ return document.elementFromPoint(x, y); }
      var first = cellAt(path[0][0], path[0][1]);
      first.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, clientX: path[0][0], clientY: path[0][1]}));
      var grid = document.getElementById('grid');
      for (var i = 1; i < path.length; i++) {
        grid.dispatchEvent(new PointerEvent('pointermove', {bubbles: true, clientX: path[i][0], clientY: path[i][1]}));
      }
      window.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, clientX: path[path.length-1][0], clientY: path[path.length-1][1]}));
      return true;
    })()`);
    await wait(300);
    check('drag-select finds the word: found 1/8', (await ev('document.getElementById("foundVal").textContent')) === '1/8');
    check('score is word length x 10', (await ev('document.getElementById("scoreVal").textContent')) === String(found.word.length * 10));
    check('word list marks it found', await ev(`Array.from(document.querySelectorAll('#wordList li')).some(function(li){ return li.classList.contains('found-word') && li.querySelector('.wl-word').textContent === ${JSON.stringify(found.word)}; })`));
  }

  check('hint flashes a cell', await (async () => {
    await ev('document.getElementById("hintBtn").click()');
    await wait(200);
    return (await ev('document.querySelectorAll("#grid .cell.hint-flash").length')) === 1;
  })());

  check('lang toggle switches title + Bengali digits', await (async () => {
    await ev('document.getElementById("langBtn").click()');
    await wait(200);
    const title = await ev('document.getElementById("title").textContent');
    const score = await ev('document.getElementById("scoreVal").textContent');
    return title !== 'Word Search BD' && /[\u09e6-\u09ef]/.test(score);
  })());
  check('lang toggle back to English', await (async () => {
    await ev('document.getElementById("langBtn").click()');
    await wait(200);
    return (await ev('document.getElementById("title").textContent')) === 'Word Search BD';
  })());

  check('new puzzle regenerates the grid', await (async () => {
    const before = await ev('Array.from(document.querySelectorAll("#grid .cell")).map(function(el){return el.textContent;}).join("")');
    await ev('document.getElementById("newBtn").click()');
    await wait(300);
    const after = await ev('Array.from(document.querySelectorAll("#grid .cell")).map(function(el){return el.textContent;}).join("")');
    const foundAfter = await ev('document.getElementById("foundVal").textContent');
    return before !== after && foundAfter === '0/8';
  })());

  check('easy difficulty renders 8x8 = 64 cells, 6 words', await (async () => {
    await ev('document.getElementById("diffSel").value = "easy"; document.getElementById("diffSel").dispatchEvent(new Event("change", {bubbles: true}));');
    await wait(300);
    const cells = await ev('document.querySelectorAll("#grid .cell").length');
    const words = await ev('document.querySelectorAll("#wordList li").length');
    return cells === 64 && words === 6;
  })());

  check('390px mobile: no horizontal overflow', await (async () => {
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await wait(300);
    const w = await ev('document.documentElement.scrollWidth');
    await send('Emulation.clearDeviceMetricsOverride', {});
    return w <= 390;
  })());

  check('zero console/page errors', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300));

  try { ws.close(); } catch (e) {}
  chrome.kill();
  console.log(failures === 0 ? 'smoke: ALL PASS' : `smoke: ${failures} FAILURES`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('smoke harness error: ' + e.message); process.exit(2); });
