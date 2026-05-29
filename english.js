/*
 * Plain English -> Sherbish document items.
 *
 * englishToItems(text) returns the same item shape render.js / the breakdown
 * already understand:
 *   { type:'word', raw, tokens:[...], syllables:[[tok,...],...], source, note }
 *   { type:'punct', glyph }   { type:'space' }   { type:'error', raw, message }
 *
 * Pronunciation comes from CMUdict (window.cmudictLookup). When a word isn't in
 * the dictionary we try light morphological backoffs (contractions,
 * possessives, plural/past/gerund) and flag the result as a guess. Anything we
 * still can't pronounce becomes an error box, so unknown words are visible
 * rather than silently wrong.
 *
 * Syllabification reuses window.syllabifySegment from ../transliterate.js.
 */
(function () {
  var VOICELESS = { P:1, T:1, K:1, F:1, TH:1, S:1, SH:1, CH:1, HH:1 };
  var SIBILANT = { S:1, Z:1, SH:1, ZH:1, CH:1, JH:1 };

  function bare(phone) { return String(phone).replace(/[0-2]$/, '').toUpperCase(); }
  function lastPhone(phones) { return phones.length ? bare(phones[phones.length - 1]) : ''; }

  // ARPABET phones for a regular "-s" ending, given the base's final phone.
  function sEnding(last) {
    if (SIBILANT[last]) return ['IH0', 'Z'];
    return VOICELESS[last] ? ['S'] : ['Z'];
  }
  // ARPABET phones for a regular "-ed" ending.
  function edEnding(last) {
    if (last === 'T' || last === 'D') return ['IH0', 'D'];
    return VOICELESS[last] ? ['T'] : ['D'];
  }

  var CONTRACTIONS = {
    "'s": null,            // handled via voicing (possessive / is / has)
    "'re": ['ER0'],
    "'ve": ['V'],
    "'ll": ['L'],
    "'d": ['D'],
    "'m": ['M'],
    "n't": ['N', 'T']
  };

  // word: already lowercased, letters + apostrophes only.
  // returns { phones:[...], source:'dict'|'guess' } | null
  function pronounce(word) {
    var lookup = window.cmudictLookup;
    var prons = lookup(word);
    if (prons) return { phones: prons[0], source: 'dict' };

    // Contraction / possessive backoff: split at the last apostrophe.
    var ap = word.lastIndexOf("'");
    if (ap > 0) {
      var stem = word.slice(0, ap);
      var suffix = word.slice(ap);                 // e.g. "'s", "'ll"
      var stemProns = lookup(stem);
      // "n't" lives across the boundary (do n't), so also try the n't form.
      if (!stemProns && /n't$/.test(word)) {
        stem = word.slice(0, word.length - 3);
        suffix = "n't";
        stemProns = lookup(stem);
      }
      if (stemProns && (suffix in CONTRACTIONS)) {
        var base = stemProns[0].slice();
        var add = CONTRACTIONS[suffix];
        if (add === null) add = sEnding(lastPhone(base)); // possessive 's
        return { phones: base.concat(add), source: 'guess' };
      }
    }

    // Inflectional backoff on a plain word.
    if (/[a-z]/.test(word)) {
      // -ing  (running -> run + ing)
      if (/ing$/.test(word)) {
        var s1 = word.slice(0, -3);
        var p1 = lookup(s1) || lookup(s1 + 'e');
        if (p1) return { phones: p1[0].concat(['IH0', 'NG']), source: 'guess' };
      }
      // -ed   (walked -> walk + ed)
      if (/ed$/.test(word)) {
        var s2 = word.slice(0, -2);
        var p2 = lookup(s2) || lookup(s2 + 'e') || lookup(word.slice(0, -1));
        if (p2) return { phones: p2[0].concat(edEnding(lastPhone(p2[0]))), source: 'guess' };
      }
      // -es / -s  (boxes -> box, cats -> cat)
      if (/es$/.test(word)) {
        var s3 = word.slice(0, -2);
        var p3 = lookup(s3) || lookup(word.slice(0, -1));
        if (p3) return { phones: p3[0].concat(sEnding(lastPhone(p3[0]))), source: 'guess' };
      }
      if (/s$/.test(word)) {
        var s4 = word.slice(0, -1);
        var p4 = lookup(s4);
        if (p4) return { phones: p4[0].concat(sEnding(lastPhone(p4[0]))), source: 'guess' };
      }
    }
    return null;
  }

  function makeWord(raw) {
    var word = raw.toLowerCase();
    var p = pronounce(word);
    if (!p) {
      return { type: 'error', raw: raw, message: '"' + raw + '" is not in the pronunciation dictionary.' };
    }
    var tokens = window.arpaPhonesToTokens(p.phones);
    if (tokens === null) {
      return { type: 'error', raw: raw, message: 'Unsupported phoneme in "' + raw + '".' };
    }
    var syllables = window.syllabifySegment(tokens);
    return {
      type: 'word', raw: raw, tokens: tokens, syllables: syllables,
      source: p.source,
      note: p.source === 'guess' ? 'guessed from word shape' : ''
    };
  }

  // Mirrors parseLatin's punctuation/whitespace handling; words are English.
  function englishToItems(text) {
    var items = [];
    var buf = '';
    var i = 0, n = text.length;

    function flush() { if (buf) { items.push(makeWord(buf)); buf = ''; } }
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
      i++; // ignore anything else
    }
    flush();
    if (items.length && lastType() === 'space') items.pop();
    return items;
  }

  window.pronounceEnglish = pronounce;
  window.englishToItems = englishToItems;
})();
