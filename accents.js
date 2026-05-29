/*
 * Accent profiles for English mode.
 *
 * Each profile bundles the accent-specific pieces:
 *   { id, name, dictUrl, parse(text) -> Map<word, [phones...][]>, toTokens(phones) -> [token...]|null }
 *
 * - General American: CMUdict (ARPABET phonemes) + the arpabet.js map.
 * - Received Pronunciation: britfone (IPA phonemes) + the RP->token remap below.
 *
 * Both parsers key by bare lowercase word, keep pronunciation variants in order
 * ([0] = primary), and strip stress marks. The rest of the app stays
 * accent-agnostic: english.js takes a profile, dictionary.js loads any dictUrl.
 */
(function () {
  // ---- General American (CMUdict, ARPABET) -------------------------------
  // "word  PH1 PH2 ...   [# comment]", variants as word(2).
  function parseCmudict(text) {
    var map = new Map();
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var hash = line.indexOf('#');
      if (hash !== -1) line = line.slice(0, hash);
      line = line.trim();
      if (!line) continue;
      var parts = line.split(/\s+/);
      var head = parts.shift();
      if (!head || parts.length === 0) continue;
      var word = head.replace(/\(\d+\)$/, '').toLowerCase();
      if (!map.has(word)) map.set(word, []);
      map.get(word).push(parts);
    }
    return map;
  }

  // ---- Received Pronunciation (britfone, IPA) ----------------------------
  // "WORD, p h o n e m e s", space-delimited IPA phonemes, stress mark ˈ/ˌ
  // attached to a phoneme; variants as WORD(2). Non-rhotic: coda /r/ is simply
  // absent in the data, so nothing to drop here.
  //
  // RP folds a larger vowel system onto the existing (GenAm-ish) glyph set:
  // the centring diphthongs become vowel + schwa, ɑː/ɒ share OH, ɜː reuses the
  // rhotic "er" glyph, ɔː -> AO. (Agreed approximate remap.)
  var RP_TO_TOKENS = {
    // monophthongs
    'i': ['EE'], 'iː': ['EE'], 'ɪ': ['IH'], 'ɛ': ['EH'], 'æ': ['AH'],
    'ɑː': ['OH'], 'ɒ': ['OH'], 'ɔː': ['AO'], 'ʊ': ['UU'], 'uː': ['OO'],
    'ɐ': ['UH'], 'ə': ['UH'], 'ɜː': ['UR'],
    // diphthongs
    'eɪ': ['AY'], 'aɪ': ['AI'], 'ɔɪ': ['OI'], 'əʊ': ['OU'], 'aʊ': ['AU'],
    'ɪə': ['IH', 'UH'], 'ɛə': ['EH', 'UH'], 'ʊə': ['UU', 'UH'],
    // consonants
    'p': ['P'], 'b': ['B'], 't': ['T'], 'd': ['D'], 'k': ['K'], 'g': ['G'],
    'tʃ': ['C'], 'dʒ': ['J'], 'f': ['F'], 'v': ['V'], 'θ': ['TH'], 'ð': ['VH'],
    's': ['S'], 'z': ['Z'], 'ʃ': ['SH'], 'ʒ': ['ZH'], 'h': ['HH'],
    'm': ['M'], 'n': ['N'], 'ŋ': ['NG'], 'l': ['L'], 'ɹ': ['R'], 'w': ['W'], 'j': ['Y']
  };

  // Reverse a phoneme->tokens map into token->"ipa, ipa" for the glyph chart.
  // Only single-token mappings are meaningful per glyph; multi-token combos
  // (the centring diphthongs) aren't a single glyph, so skip them.
  function buildTokenIpa(map) {
    var rev = {};
    Object.keys(map).forEach(function (ipa) {
      var toks = map[ipa];
      if (toks.length !== 1) return;
      var t = toks[0];
      if (!rev[t]) rev[t] = [];
      if (rev[t].indexOf(ipa) === -1) rev[t].push(ipa);
    });
    var out = {};
    Object.keys(rev).forEach(function (t) { out[t] = rev[t].join(', '); });
    return out;
  }

  function stripStressIpa(p) { return p.replace(/[ˈˌ]/g, ''); } // ˈ ˌ

  function britfoneToTokens(phones) {
    var out = [];
    for (var i = 0; i < phones.length; i++) {
      var t = RP_TO_TOKENS[phones[i]];
      if (!t) return null;
      out = out.concat(t);
    }
    return out;
  }

  function parseBritfone(text) {
    var map = new Map();
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var ci = line.indexOf(',');
      if (ci < 0) continue;
      var word = line.slice(0, ci).trim().replace(/\(\d+\)$/, '').toLowerCase();
      var phones = line.slice(ci + 1).trim().split(/\s+/)
        .map(stripStressIpa).filter(Boolean);
      if (!word || !phones.length) continue;
      if (!map.has(word)) map.set(word, []);
      map.get(word).push(phones);
    }
    return map;
  }

  window.ACCENTS = {
    genam: {
      id: 'genam', name: 'General American', dictUrl: 'cmudict.dict',
      parse: parseCmudict, toTokens: window.arpaPhonesToTokens,
      tokenIpa: null   // glyph.ipa is already the General American value
    },
    rp: {
      id: 'rp', name: 'Received Pronunciation', dictUrl: 'britfone.csv',
      parse: parseBritfone, toTokens: britfoneToTokens,
      tokenIpa: buildTokenIpa(RP_TO_TOKENS)
    }
  };
})();
