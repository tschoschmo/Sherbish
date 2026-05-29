/*
 * Generic pronunciation-dictionary loader.
 *
 * window.loadDict(url, parse) fetches the file once (cached per URL), parses it
 * with the supplied parse(text) -> Map<word, [phones...][]>, and resolves to a
 * lookup(word) -> [[phones...], ...] | null. Each accent profile (accents.js)
 * supplies its own url + parser, so this stays format-agnostic.
 *
 * Loaded lazily by app.js the first time an accent is used, keeping the larger
 * dictionaries off sessions that don't need them. Must be served over http.
 */
(function () {
  var cache = {};

  window.loadDict = function (url, parse) {
    if (cache[url]) return cache[url];
    cache[url] = fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error(url + ' -> HTTP ' + r.status);
        return r.text();
      })
      .then(function (text) {
        var map = parse(text);
        return function lookup(word) {
          return map.get(String(word).toLowerCase()) || null;
        };
      });
    return cache[url];
  };
})();
