/*
 * Plain English -> Sherbish document items (accent-agnostic).
 *
 * englishToItems(text, profile) returns the same item shape render.js / the
 * breakdown understand:
 *   { type:'word', raw, tokens:[...], syllables:[[tok,...],...], source, note }
 *   { type:'punct', glyph }   { type:'space' }   { type:'error', raw, message }
 *
 * profile = { name, lookup(word)->[[phones..]..]|null, toTokens(phones)->[tok..]|null }
 * comes from accents.js (General American / RP). All accent-specific knowledge
 * lives in the profile; everything here works in Sherbish-token space.
 *
 * Words not in the dictionary get light morphological backoffs (contractions,
 * possessives, plural/past/gerund) done at the token level, flagged as guesses;
 * anything still unresolved becomes a visible error box. Syllabification reuses
 * window.syllabifySegment from transliterate.js.
 */
(function () {
  // Token-level voicing classes (Sherbish tokens, so accent-independent).
  var VOICELESS = { P: 1, T: 1, K: 1, F: 1, TH: 1, S: 1, SH: 1, C: 1, HH: 1 };
  var SIBILANT = { S: 1, Z: 1, SH: 1, ZH: 1, C: 1, J: 1 };

  function sEnd(last) {
    if (SIBILANT[last]) return ['IH', 'Z'];
    return VOICELESS[last] ? ['S'] : ['Z'];
  }
  function edEnd(last) {
    if (last === 'T' || last === 'D') return ['IH', 'D'];
    return VOICELESS[last] ? ['T'] : ['D'];
  }

  // Contraction suffix -> appended tokens. "'s" is voicing-dependent (null).
  // "'re" reduces to a schwa (UH) — fine for both rhotic and non-rhotic here.
  var CONTRACTIONS = {
    "'s": null, "'re": ['UH'], "'ve": ['V'], "'ll": ['L'],
    "'d": ['D'], "'m": ['M'], "n't": ['N', 'T']
  };

  // Look a word up and convert straight to tokens, or null if missing/unmappable.
  function stemTokens(word, profile) {
    var prons = profile.lookup(word);
    if (!prons) return null;
    return profile.toTokens(prons[0]);
  }

  // -> { tokens:[...]|null, source:'dict'|'guess' } | null
  //    tokens === null means "found but had an unsupported phoneme".
  function pronounce(word, profile) {
    var prons = profile.lookup(word);
    if (prons) return { tokens: profile.toTokens(prons[0]), source: 'dict' };

    // Contraction / possessive: split at the last apostrophe.
    var ap = word.lastIndexOf("'");
    if (ap > 0) {
      var stem = word.slice(0, ap), suffix = word.slice(ap);
      var st = stemTokens(stem, profile);
      if (!st && /n't$/.test(word)) { stem = word.slice(0, -3); suffix = "n't"; st = stemTokens(stem, profile); }
      if (st && (suffix in CONTRACTIONS)) {
        var add = CONTRACTIONS[suffix];
        if (add === null) add = sEnd(st[st.length - 1]);
        return { tokens: st.concat(add), source: 'guess' };
      }
    }

    // Inflectional backoff.
    if (/[a-z]/.test(word)) {
      if (/ing$/.test(word)) {
        var a = word.slice(0, -3);
        var ta = stemTokens(a, profile) || stemTokens(a + 'e', profile);
        if (ta) return { tokens: ta.concat(['IH', 'NG']), source: 'guess' };
      }
      if (/ed$/.test(word)) {
        var b = word.slice(0, -2);
        var tb = stemTokens(b, profile) || stemTokens(b + 'e', profile) || stemTokens(word.slice(0, -1), profile);
        if (tb) return { tokens: tb.concat(edEnd(tb[tb.length - 1])), source: 'guess' };
      }
      if (/es$/.test(word)) {
        var c = word.slice(0, -2);
        var tc = stemTokens(c, profile) || stemTokens(word.slice(0, -1), profile);
        if (tc) return { tokens: tc.concat(sEnd(tc[tc.length - 1])), source: 'guess' };
      }
      if (/s$/.test(word)) {
        var d = word.slice(0, -1);
        var td = stemTokens(d, profile);
        if (td) return { tokens: td.concat(sEnd(td[td.length - 1])), source: 'guess' };
      }
    }
    return null;
  }

  // Merge adjacent consonant clusters onto their ligature glyphs:
  // /ks/ -> KS (the "x" glyph), /kw/ -> KW (the "q" glyph).
  function combineClusters(tokens) {
    var out = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i], n = tokens[i + 1];
      if (t === 'K' && n === 'S') { out.push('KS'); i++; }
      else if (t === 'K' && n === 'W') { out.push('KW'); i++; }
      else out.push(t);
    }
    return out;
  }

  function makeWord(raw, profile) {
    var word = raw.toLowerCase();
    var p = pronounce(word, profile);
    if (!p) {
      return { type: 'error', raw: raw, message: '"' + raw + '" is not in the ' + profile.name + ' dictionary.' };
    }
    if (!p.tokens) {
      return { type: 'error', raw: raw, message: 'Unsupported phoneme in "' + raw + '".' };
    }
    var tokens = combineClusters(p.tokens);
    return {
      type: 'word', raw: raw, tokens: tokens,
      syllables: window.syllabifySegment(tokens),
      source: p.source, note: p.source === 'guess' ? 'guessed from word shape' : ''
    };
  }

  // Mirrors parseLatin's punctuation/whitespace handling; words are English.
  function englishToItems(text, profile) {
    var items = [];
    var buf = '';
    var i = 0, n = text.length;

    function flush() { if (buf) { items.push(makeWord(buf, profile)); buf = ''; } }
    function lastType() { return items.length ? items[items.length - 1].type : null; }

    while (i < n) {
      var c = text[i];
      if (/[A-Za-z']/.test(c)) { buf += c; i++; continue; }
      flush();
      if (/\s/.test(c)) {
        while (i < n && /\s/.test(text[i])) i++;
        if (items.length && lastType() !== 'space') items.push({ type: 'space' });
        continue;
      }
      if (c === '.') {
        var j = i; while (j < n && text[j] === '.') j++;
        items.push({ type: 'punct', glyph: (j - i) >= 2 ? 'ELLIPSIS' : 'PERIOD' });
        i = j; continue;
      }
      if (c === '?') { items.push({ type: 'punct', glyph: 'QUESTION' }); i++; continue; }
      if (c === '!') { items.push({ type: 'punct', glyph: 'EXCLAM' }); i++; continue; }
      if (c === ',') { items.push({ type: 'punct', glyph: 'COMMA' }); i++; continue; }
      i++;
    }
    flush();
    if (items.length && lastType() === 'space') items.pop();
    return items;
  }

  window.englishToItems = englishToItems;
})();
