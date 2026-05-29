/*
 * Latin encoding -> structured document.
 *
 * parseLatin(text) returns an array of items:
 *   { type: 'word',  raw, tokens:[...], syllables:[[tok,...],...] }
 *   { type: 'punct', glyph: 'PERIOD' | 'QUESTION' | 'ELLIPSIS' | 'EXCLAM' | 'COMMA' }
 *   { type: 'space' }                         (rendered as the word-divider dot)
 *   { type: 'error', raw, message }           (a word that could not be tokenized)
 *
 * Syllabification follows the doc's "one vowel per syllable" rule. A single
 * consonant between two vowels becomes the onset of the following syllable
 * (HHEHLOU -> HHEH | LOU); with a cluster, only the last consonant moves to the
 * onset and the rest stay as coda (KWEHSCHUHN -> KWEHS | CHUHN). An apostrophe
 * forces a syllable break, pinyin-style.
 */
(function () {
  // Built lazily: the token lists load asynchronously (see glyphs.js), so they
  // aren't on window yet when this script first runs.
  var TWO = null, ONE = null;
  function ensureSets() {
    if (!TWO) {
      TWO = new Set(window.TWO_CHAR_TOKENS);
      ONE = new Set(window.ONE_CHAR_TOKENS);
    }
  }

  function canon(t) { return window.ALIASES[t] || t; }

  function isNucleus(t) {
    var g = window.GLYPHS[t];
    return !!(g && g.nucleus);
  }

  // Backtracking, leftmost-longest tokenizer. Returns canonical tokens or null.
  function tokenizeSegment(seg) {
    ensureSets();
    seg = seg.toUpperCase();
    var memo = new Map();
    function go(idx) {
      if (idx === seg.length) return [];
      if (memo.has(idx)) return memo.get(idx);
      var result = null;
      if (idx + 2 <= seg.length) {
        var two = seg.substr(idx, 2);
        if (TWO.has(two)) {
          var rest2 = go(idx + 2);
          if (rest2 !== null) result = [canon(two)].concat(rest2);
        }
      }
      if (result === null && idx + 1 <= seg.length) {
        var one = seg.substr(idx, 1);
        if (ONE.has(one)) {
          var rest1 = go(idx + 1);
          if (rest1 !== null) result = [canon(one)].concat(rest1);
        }
      }
      memo.set(idx, result);
      return result;
    }
    return go(0);
  }

  // Split one apostrophe-free token list into syllables.
  function syllabifySegment(tokens) {
    if (tokens.length === 0) return [];
    var nuclei = [];
    tokens.forEach(function (t, idx) { if (isNucleus(t)) nuclei.push(idx); });
    if (nuclei.length === 0) return [tokens.slice()]; // vowel-less syllable (e.g. "WT")

    var cuts = [0];
    for (var k = 0; k < nuclei.length - 1; k++) {
      var a = nuclei[k], b = nuclei[k + 1];
      var gap = b - a - 1;
      cuts.push(gap === 0 ? b : b - 1);
    }
    cuts.push(tokens.length);

    var sylls = [];
    for (var j = 0; j < cuts.length - 1; j++) {
      sylls.push(tokens.slice(cuts[j], cuts[j + 1]));
    }
    return sylls;
  }

  function makeWord(raw) {
    var segments = raw.split("'");
    var allTokens = [];
    var allSylls = [];
    for (var s = 0; s < segments.length; s++) {
      var seg = segments[s];
      if (seg === '') continue; // leading/trailing/double apostrophe
      var toks = tokenizeSegment(seg);
      if (toks === null) {
        return { type: 'error', raw: raw, message: 'Could not parse "' + seg + '" into known tokens.' };
      }
      allTokens = allTokens.concat(toks);
      allSylls = allSylls.concat(syllabifySegment(toks));
    }
    if (allSylls.length === 0) {
      return { type: 'error', raw: raw, message: 'Empty word.' };
    }
    return { type: 'word', raw: raw, tokens: allTokens, syllables: allSylls };
  }

  function parseLatin(text) {
    var items = [];
    var buf = '';
    var i = 0;
    var n = text.length;

    function flush() {
      if (buf) { items.push(makeWord(buf)); buf = ''; }
    }
    function lastType() {
      return items.length ? items[items.length - 1].type : null;
    }

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
        var j = i;
        while (j < n && text[j] === '.') j++;
        items.push({ type: 'punct', glyph: (j - i) >= 2 ? 'ELLIPSIS' : 'PERIOD' });
        i = j;
        continue;
      }
      if (c === '?') { items.push({ type: 'punct', glyph: 'QUESTION' }); i++; continue; }
      if (c === '!') { items.push({ type: 'punct', glyph: 'EXCLAM' }); i++; continue; }
      if (c === ',') { items.push({ type: 'punct', glyph: 'COMMA' }); i++; continue; }
      // Unknown character: ignore it.
      i++;
    }
    flush();

    // Drop a dangling trailing space divider.
    if (items.length && lastType() === 'space') items.pop();
    return items;
  }

  window.parseLatin = parseLatin;
  window.tokenizeSegment = tokenizeSegment;
  window.syllabifySegment = syllabifySegment;
})();
