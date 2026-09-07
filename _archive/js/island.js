/* =====================================================================
   Katalina's Island
   ---------------------------------------------------------------------
   The island is a grid of Braille characters. Moving the cursor drops
   waves into it, and each wave scrambles the characters sitting on its
   leading edge as it travels outward, so the dots break up and settle
   again like water closing over a stone.

   The wave model is adapted from Bastien Cornier's ASCII Glitch Ripple
   (https://codepen.io/erevan/pen/MYKBjdZ), which runs along a single
   line of text. This version works across two dimensions, measures
   distance in real screen space so the rings come out round rather than
   oval, and scrambles through Braille patterns instead of ASCII so the
   art never stops looking like dots.
   ===================================================================== */

(function () {
  'use strict';

  var BLANK = '⠀';   // Braille pattern blank: the empty cells

  // All 256 Braille patterns, sorted into buckets by how many dots they
  // carry. A cell only ever swaps for another pattern of roughly its own
  // weight, so a wave reads as the dots shifting rather than as the art
  // glitching: no single dot ever flares into a solid block.
  var BUCKETS = [];
  (function () {
    for (var n = 0; n <= 8; n++) BUCKETS.push([]);
    for (var i = 1; i < 256; i++) {
      var bits = 0, v = i;
      while (v) { bits += v & 1; v >>= 1; }
      BUCKETS[bits].push(String.fromCharCode(0x2800 + i));
    }
  })();

  var CFG = {
    dur: 1800,      // ms for one ripple to grow to full size
    reach: 26,      // how far a single ripple travels, in cells.
                    // Small and local: a stone in the water, not a
                    // shockwave across the whole island.
    band: 2.4,      // thickness of the crest, thinning as it spreads
    step: 45,       // ms between character swaps inside the crest
    churn: 2,       // how fast the swap walks with distance
    minGap: 70,     // ms between ripples, so a fast cursor cannot flood it
    minMove: 2.4,   // cells the cursor must travel to drop another one
    maxWaves: 12
  };

  // ---------------------------------------------------------------
  // Ripple over a 2D character grid
  // ---------------------------------------------------------------
  function createRipple(pre) {
    var rows = pre.textContent.replace(/\n$/, '').split('\n');
    var nRows = rows.length;
    var nCols = 0;
    for (var i = 0; i < nRows; i++) nCols = Math.max(nCols, rows[i].length);
    for (i = 0; i < nRows; i++) {
      while (rows[i].length < nCols) rows[i] += BLANK;
    }
    var original = rows.join('\n');

    // Flat copy of the grid, plus how many dots each cell carries.
    // Both are worked out once here rather than 6000 times a frame.
    var grid = [];
    var weight = [];
    for (i = 0; i < nRows; i++) {
      var line = rows[i].split('');
      var w = new Uint8Array(nCols);
      for (var j = 0; j < nCols; j++) {
        var v = line[j].charCodeAt(0) - 0x2800, bits = 0;
        while (v > 0) { bits += v & 1; v >>= 1; }
        w[j] = bits;
      }
      grid.push(line);
      weight.push(w);
    }

    var waves = [];
    var raf = null;
    var lastWave = 0;
    var lastCell = { c: -99, r: -99 };
    var cellW = 8, cellH = 14, aspect = 1;

    function measure() {
      var rect = pre.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      cellW = rect.width / nCols;
      cellH = rect.height / nRows;
      aspect = cellH / cellW;   // cells are taller than they are wide
    }

    // page coordinates -> grid coordinates, fractional
    function toGrid(clientX, clientY) {
      var rect = pre.getBoundingClientRect();
      return {
        c: (clientX - rect.left) / cellW,
        r: (clientY - rect.top) / cellH
      };
    }

    function drop(clientX, clientY) {
      var t = performance.now();
      if (t - lastWave < CFG.minGap) return;
      var g = toGrid(clientX, clientY);
      var moved = Math.abs(g.c - lastCell.c) + Math.abs(g.r - lastCell.r) * aspect;
      if (moved < CFG.minMove) return;

      lastWave = t;
      lastCell = g;
      waves.push({ c: g.c, r: g.r, t0: t });
      if (waves.length > CFG.maxWaves) waves.shift();
      if (!raf) raf = requestAnimationFrame(render);
    }

    function render() {
      var t = performance.now();

      var live = [];
      for (var k = 0; k < waves.length; k++) {
        if (t - waves[k].t0 < CFG.dur) live.push(waves[k]);
      }
      waves = live;

      if (!waves.length) {
        pre.textContent = original;
        raf = null;
        return;
      }

      // Precompute each wave's current radius once, not once per cell.
      // The crest thins as the ripple spreads, so it dies away instead
      // of stopping dead at the edge of its reach.
      var wr = [];
      for (k = 0; k < waves.length; k++) {
        var age = t - waves[k].t0;
        var prog = age / CFG.dur;
        wr.push({
          c: waves[k].c,
          r: waves[k].r,
          rad: prog * CFG.reach,
          band: CFG.band * (1 - 0.7 * prog),
          tick: Math.floor(age / CFG.step)
        });
      }

      var out = '';
      for (var y = 0; y < nRows; y++) {
        var row = grid[y];
        var wrow = weight[y];
        for (var x = 0; x < nCols; x++) {
          var ch = row[x];
          // Empty cells stay empty. Without this the ripples would spray
          // dots out into the sky around the island.
          if (ch !== BLANK) {
            for (k = 0; k < wr.length; k++) {
              var w = wr[k];
              var dx = x - w.c;
              var dy = (y - w.r) * aspect;
              var dist = Math.sqrt(dx * dx + dy * dy);
              var edge = w.rad - dist;
              if (edge > 0 && edge <= w.band) {
                // Dots gather at the front of the crest and thin out
                // behind it, the way water piles up and then hollows.
                var f = edge / w.band;
                var lift = f < 0.38 ? 1 : (f < 0.72 ? 0 : -1);
                var b = BUCKETS[Math.max(1, Math.min(8, wrow[x] + lift))];
                ch = b[(Math.round(dist * CFG.churn) + w.tick) % b.length];
                break;
              }
            }
          }
          out += ch;
        }
        if (y < nRows - 1) out += '\n';
      }

      pre.textContent = out;
      raf = requestAnimationFrame(render);
    }

    // ---- fit the grid to the window ------------------------------
    function fit() {
      var box = pre.parentElement;
      if (!box) return;
      pre.style.fontSize = '10px';
      var w = pre.scrollWidth, h = pre.scrollHeight;
      if (!w || !h) return;
      // The art is much wider than it is tall, so width is normally the
      // binding constraint and the island runs edge to edge. Height only
      // takes over on a short window. Monospace scales linearly, so one
      // proportional step lands it exactly.
      var size = 10 * Math.min(
        (box.clientWidth * 0.98) / w,
        (box.clientHeight * 0.88) / h
      );
      pre.style.fontSize = Math.max(2, Math.min(size, 44)) + 'px';
      measure();
    }

    return { drop: drop, fit: fit, measure: measure };
  }

  // ---------------------------------------------------------------
  // Ripple along a single line of text, for the nav
  // ---------------------------------------------------------------
  function createTextRipple(el) {
    var text = el.textContent;
    var chars = text.split('');
    // Kept to characters a display sans actually ships, so the nav
    // never falls back to a different font mid-animation.
    var scramble = '.,-~+:;=*/\\|<>^%#&';
    var waves = [];
    var raf = null;

    function pos(e) {
      var rect = el.getBoundingClientRect();
      var p = Math.round(((e.clientX - rect.left) / rect.width) * chars.length);
      return Math.max(0, Math.min(p, chars.length - 1));
    }

    function drop(e) {
      waves.push({ p: pos(e), t0: performance.now() });
      if (waves.length > 4) waves.shift();
      if (!raf) {
        el.style.width = el.getBoundingClientRect().width + 'px';
        raf = requestAnimationFrame(render);
      }
    }

    function render() {
      var t = performance.now();
      waves = waves.filter(function (w) { return t - w.t0 < 700; });
      if (!waves.length) {
        el.textContent = text;
        el.style.width = '';
        raf = null;
        return;
      }
      var out = '';
      for (var i = 0; i < chars.length; i++) {
        var ch = chars[i];
        if (ch !== ' ') {
          for (var k = 0; k < waves.length; k++) {
            var age = t - waves[k].t0;
            var rad = (age / 700) * (chars.length + 4);
            var d = Math.abs(i - waves[k].p);
            var edge = rad - d;
            if (edge > 0 && edge <= 2.5) {
              ch = scramble[(d * 3 + Math.floor(age / 40)) % scramble.length];
              break;
            }
          }
        }
        out += ch;
      }
      el.textContent = out;
      raf = requestAnimationFrame(render);
    }

    el.addEventListener('mouseenter', drop);
    el.addEventListener('mousemove', drop);
  }

  // ---------------------------------------------------------------
  function init() {
    var pre = document.getElementById('island');
    if (!pre) return;

    var reduced = window.matchMedia &&
                  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var island = createRipple(pre);
    island.fit();
    // webfonts can land after first paint and change the metrics
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(island.fit);
    }
    window.addEventListener('load', island.fit);

    var resizeT;
    window.addEventListener('resize', function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(island.fit, 120);
    });

    if (!reduced) {
      // The whole page is water, not just the art. A wave dropped out
      // in the corner sweeps in across the island.
      window.addEventListener('pointermove', function (e) {
        island.drop(e.clientX, e.clientY);
      }, { passive: true });

      window.addEventListener('touchmove', function (e) {
        var p = e.touches[0];
        if (p) island.drop(p.clientX, p.clientY);
      }, { passive: true });

      var links = document.querySelectorAll('.island-nav a');
      for (var i = 0; i < links.length; i++) createTextRipple(links[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
