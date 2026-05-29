/*
 * CMU Pronouncing Dictionary loader.
 *
 * cmudict.dict is the public-domain CMU dict (~135k words). Each line is:
 *     word  PH1 PH2 PH3 ...        [# optional comment]
 * Variant pronunciations are "word(2)", "word(3)", etc. We key everything by
 * the bare lowercase word and keep variants in order, so [0] is the primary.
 *
 * Loaded lazily: window.loadDictionary() kicks off the (one-time) fetch+parse
 * and returns a promise resolving to lookup(word) -> [[phones...], ...] | null.
 * This keeps the 3.6 MB file off Latin-only sessions until English mode is used.
 */
(function () {
  function parse(text) {
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

  var dictPromise = null;

  window.loadDictionary = function () {
    if (dictPromise) return dictPromise;
    dictPromise = fetch('cmudict.dict')
      .then(function (r) {
        if (!r.ok) throw new Error('cmudict.dict -> HTTP ' + r.status);
        return r.text();
      })
      .then(function (text) {
        var map = parse(text);
        function lookup(word) {
          var prons = map.get(String(word).toLowerCase());
          return prons || null;
        }
        window.cmudict = map;
        window.cmudictLookup = lookup;
        return lookup;
      });
    return dictPromise;
  };
})();
