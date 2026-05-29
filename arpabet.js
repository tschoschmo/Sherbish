/*
 * ARPABET (CMUdict) phoneme -> Sherbish token mapping.
 *
 * CMUdict uses the standard 39-phoneme ARPABET set. Vowels carry a stress
 * digit (0/1/2) which Sherbish ignores, so we strip it. Every ARPABET phoneme
 * maps cleanly onto an existing Sherbish token except AO (ɔ, "thought/caught"),
 * which uses the new placeholder AO token.
 *
 * Notes / deliberate choices:
 *   - x and qu come through CMUdict as separate K S / K W phonemes, so they
 *     render as K+S / K+W rather than the KS / KW ligature glyphs. Same sound.
 *   - CMUdict marks no syllabic L/N; it spells them AH0 L / AH0 N, so they come
 *     out as UH+L / UH+N rather than the UL vowel. (Refinement left for later.)
 */
(function () {
  var ARPA_TO_TOKEN = {
    // vowels
    AA: 'OH',  // ɑ  odd / father
    AE: 'AH',  // æ  at
    AH: 'UH',  // ʌ / ə  hut / schwa
    AO: 'AO',  // ɔ  thought / caught  (placeholder glyph)
    AW: 'AU',  // aʊ cow
    AY: 'AI',  // aɪ hide / the word I
    EH: 'EH',  // ɛ  Ed
    ER: 'UR',  // ɝ/ɚ hurt / farmer
    EY: 'AY',  // eɪ ate / day
    IH: 'IH',  // ɪ  it
    IY: 'EE',  // i  eat / free
    OW: 'OU',  // oʊ oat / ozone
    OY: 'OI',  // ɔɪ toy
    UH: 'UU',  // ʊ  hood / book
    UW: 'OO',  // u  two / doom
    // consonants
    B: 'B', CH: 'C', D: 'D', DH: 'VH', F: 'F', G: 'G', HH: 'HH',
    JH: 'J', K: 'K', L: 'L', M: 'M', N: 'N', NG: 'NG', P: 'P',
    R: 'R', S: 'S', SH: 'SH', T: 'T', TH: 'TH', V: 'V', W: 'W',
    Y: 'Y', Z: 'Z', ZH: 'ZH'
  };

  function stripStress(phone) { return phone.replace(/[0-2]$/, ''); }

  // phones: array of ARPABET symbols (with stress). -> array of Sherbish tokens,
  // or null if any phoneme is unrecognized.
  function arpaPhonesToTokens(phones) {
    var out = [];
    for (var i = 0; i < phones.length; i++) {
      var p = stripStress(String(phones[i]).toUpperCase());
      if (!p) continue;
      var tok = ARPA_TO_TOKEN[p];
      if (!tok) return null;
      out.push(tok);
    }
    return out;
  }

  window.ARPA_TO_TOKEN = ARPA_TO_TOKEN;
  window.arpaPhonesToTokens = arpaPhonesToTokens;
})();
