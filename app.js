/* UI wiring for the Sherbish transliterator (Latin + English modes). */
(function () {
  var inputEl = document.getElementById('input');
  var outEl = document.getElementById('output');
  var bdEl = document.getElementById('breakdown');
  var chartEl = document.getElementById('chart');
  var guidesEl = document.getElementById('guides');
  var sizeEl = document.getElementById('size');
  var hintEl = document.getElementById('parse-hint');
  var downloadEl = document.getElementById('download');
  var examplesEl = document.getElementById('examples');
  var ipaEl = document.getElementById('ipa');
  var modesEl = document.getElementById('modes');
  var labelEl = document.getElementById('input-label');
  var taglineEl = document.getElementById('tagline');
  var tokensPanelEl = document.getElementById('tokens-panel');
  var tokensEl = document.getElementById('tokens');
  var accentEl = document.getElementById('accent');
  var accentGroupEl = document.getElementById('accent-group');

  var mode = 'latin';      // 'latin' | 'english'
  var accentId = 'genam';  // 'genam' | 'rp'
  var lookups = {};        // dictUrl -> resolved lookup(word)
  var lastSvg = '';

  var LATIN = {
    label: 'Latin encoding',
    tagline: 'Type the Latin encoding &mdash; tokens like <code>HHEHLOU</code> &mdash; and see the script. Words split on spaces; <code>\'</code> forces a syllable break.',
    placeholder: 'HHEHLOU',
    defaultText: 'HHEHLOU. TURTEHLS HHAHV SHEHLS. TOO BEE OUR NOUT TOO BEE, VHAHT IHZ VHEE KWEHSCHUHN?',
    examples: [
      { label: 'hello', text: 'HHEHLOU' },
      { label: 'Turtles have shells', text: 'TURTEHLS HHAHV SHEHLS' },
      { label: 'To be, or not to be…', text: 'TOO BEE OUR NOUT TOO BEE, VHAHT IHZ VHEE KWEHSCHUHN?' },
      { label: 'What are you doing tonight?', text: 'WT OHR YOO DOOIHNG TOONAIT?' },
      { label: 'Four score and seven years ago…', text: 'FOUR SKOUR AHND SEHVEHN YEERS UHGOU..' }
    ]
  };
  var ENGLISH = {
    label: 'Plain English',
    tagline: 'Type <strong>plain English</strong>. Words are looked up in a pronouncing dictionary for the selected accent, mapped to Sherbish phonemes, then drawn. Words guessed from their shape are flagged; unknown words show as red boxes.',
    placeholder: 'Hello, world',
    defaultText: 'Hello. Turtles have shells. To be, or not to be, that is the question?',
    examples: [
      { label: 'Hello.', text: 'Hello.' },
      { label: 'Turtles have shells.', text: 'Turtles have shells.' },
      { label: 'To be, or not to be…', text: 'To be, or not to be, that is the question?' },
      { label: 'What are you doing tonight?', text: 'What are you doing tonight?' },
      { label: 'Four score and seven years ago…', text: 'Four score and seven years ago.' }
    ]
  };
  function cfg() { return mode === 'english' ? ENGLISH : LATIN; }

  function esc(s) {
    return String(s).replace(/[<>&]/g, function (c) {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c];
    });
  }

  function syllableIpa(tokens) {
    return tokens.map(function (t) {
      var g = window.GLYPHS[t];
      return g && g.ipa ? g.ipa : '';
    }).join('');
  }

  function applySize() {
    var svg = outEl.querySelector('svg');
    if (!svg) return;
    var vb = svg.getAttribute('viewBox').split(/\s+/);
    var w = parseFloat(vb[2]);
    var cellPx = parseFloat(sizeEl.value);
    svg.style.width = (w / 100 * cellPx) + 'px';
    svg.style.height = 'auto';
  }

  // Phoneme-token string for the rendered text (the Latin encoding equivalent).
  function tokenString(items) {
    return items.map(function (it) {
      if (it.type === 'word') return it.tokens.join('');
      if (it.type === 'space') return ' ';
      if (it.type === 'punct') {
        return { PERIOD: '.', ELLIPSIS: '..', QUESTION: '?', EXCLAM: '!', COMMA: ',' }[it.glyph] || '';
      }
      if (it.type === 'error') return '?' + it.raw + '?';
      return '';
    }).join('').replace(/\s+([.,?!])/g, '$1').trim();
  }

  function renderBreakdown(items) {
    var html = '';
    var errors = 0, guesses = 0;
    items.forEach(function (it) {
      if (it.type === 'word') {
        var syl = it.syllables.map(function (s) { return s.join('-'); }).join('  |  ');
        var ipa = it.syllables.map(syllableIpa).join('  |  ');
        var isGuess = it.source === 'guess';
        if (isGuess) guesses++;
        html += '<div class="bd-word' + (isGuess ? ' guess' : '') + '"><span class="bd-raw">' + esc(it.raw) +
          '</span><span class="bd-syl">' + esc(syl) + '</span>' +
          (ipa ? '<span class="bd-ipa">' + esc(ipa) + '</span>' : '') +
          (isGuess ? '<span class="bd-flag">' + esc(it.note || 'guessed') + '</span>' : '') + '</div>';
      } else if (it.type === 'error') {
        errors++;
        html += '<div class="bd-err"><span class="bd-raw">' + esc(it.raw) + '</span><span>' + esc(it.message) + '</span></div>';
      } else if (it.type === 'space') {
        html += '<div class="bd-sep">&bull;</div>';
      } else if (it.type === 'punct') {
        var g = window.GLYPHS[it.glyph];
        html += '<div class="bd-punct">' + esc(g ? g.label : it.glyph) + '</div>';
      }
    });
    bdEl.innerHTML = html || '<span class="bd-sep">(empty)</span>';
    return { errors: errors, guesses: guesses };
  }

  function draw(items) {
    var res = window.renderDocument(items, { guides: guidesEl.checked, ipa: ipaEl.checked, maxWidth: 1500 });
    outEl.innerHTML = res.svg;
    lastSvg = res.svg;
    applySize();
    var counts = renderBreakdown(items);

    if (mode === 'english') {
      tokensEl.textContent = tokenString(items) || '—';
      var msg = [];
      if (counts.errors) msg.push(counts.errors + ' word(s) not in the dictionary (red).');
      if (counts.guesses) msg.push(counts.guesses + ' word(s) guessed from word shape (amber).');
      hintEl.textContent = msg.join(' ');
      hintEl.className = 'hint' + (counts.guesses && !counts.errors ? ' warn' : '');
    } else {
      hintEl.textContent = counts.errors
        ? counts.errors + ' word(s) could not be parsed — see the breakdown below (highlighted red).'
        : '';
      hintEl.className = 'hint';
    }
  }

  function update() {
    if (!window.GLYPHS) return;
    if (mode === 'english') {
      var acc = window.ACCENTS[accentId];
      var lk = lookups[acc.dictUrl];
      if (!lk) {
        hintEl.textContent = 'Loading the ' + acc.name + ' pronunciation dictionary…';
        hintEl.className = 'hint';
        window.loadDict(acc.dictUrl, acc.parse).then(function (lookup) {
          lookups[acc.dictUrl] = lookup;
          update();
        }).catch(function (err) {
          hintEl.textContent = 'Could not load the dictionary: ' + String(err && err.message || err);
          hintEl.className = 'hint warn';
        });
        return;
      }
      draw(window.englishToItems(inputEl.value, { name: acc.name, lookup: lk, toTokens: acc.toTokens }));
    } else {
      draw(window.parseLatin(inputEl.value));
    }
  }

  function buildChart() {
    var html = '';
    window.CHART_GROUPS.forEach(function (grp) {
      html += '<h3>' + esc(grp.title) + '</h3><div class="chart-grid">';
      grp.tokens.forEach(function (tk) {
        var g = window.GLYPHS[tk];
        if (!g) return;
        html += '<div class="tile-card">' + window.renderGlyphTile(tk) +
          '<div class="tile-label">' + esc(g.label) + '</div>' +
          (g.ipa ? '<div class="tile-ipa">/' + esc(g.ipa) + '/</div>' : '') +
          '<div class="tile-sound">' + esc(g.sound) + '</div></div>';
      });
      html += '</div>';
    });
    chartEl.innerHTML = html;
  }

  function buildExamples() {
    examplesEl.innerHTML = '';
    cfg().examples.forEach(function (ex) {
      var b = document.createElement('button');
      b.textContent = ex.label;
      b.addEventListener('click', function () { inputEl.value = ex.text; update(); });
      examplesEl.appendChild(b);
    });
  }

  function applyMode() {
    var c = cfg();
    labelEl.textContent = c.label;
    taglineEl.innerHTML = c.tagline;
    inputEl.placeholder = c.placeholder;
    tokensPanelEl.hidden = (mode !== 'english');
    accentGroupEl.hidden = (mode !== 'english');
    Array.prototype.forEach.call(modesEl.children, function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });
    buildExamples();
  }

  modesEl.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    var next = btn.getAttribute('data-mode');
    if (next === mode) return;
    mode = next;
    inputEl.value = cfg().defaultText;
    applyMode();
    update();
  });

  downloadEl.addEventListener('click', function () {
    if (!lastSvg) return;
    var blob = new Blob([lastSvg], { type: 'image/svg+xml' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'sherbish.svg';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  accentEl.addEventListener('change', function () {
    accentId = accentEl.value;
    update();
  });

  inputEl.addEventListener('input', update);
  guidesEl.addEventListener('change', update);
  ipaEl.addEventListener('change', update);
  sizeEl.addEventListener('input', applySize);

  inputEl.value = LATIN.defaultText;
  window.glyphsReady.then(function () {
    applyMode();
    buildChart();
    update();
  });
})();
