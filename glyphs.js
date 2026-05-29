/*
 * Glyph loader.
 *
 * The glyph set now lives in data files, not inline here:
 *   - glyph-data.json   : per-token metadata (file, kind, nucleus, height,
 *                         label, sound, IPA) plus the tokenizer config.
 *   - glyphs/<file>.svg : one standalone, editable drawing per glyph, each in a
 *                         0..100 box. Edit these to change a shape.
 *
 * This script fetches them and rebuilds the same globals the rest of the app
 * expects (window.GLYPHS, TWO_CHAR_TOKENS, ONE_CHAR_TOKENS, ALIASES,
 * CHART_GROUPS). Because fetch() is blocked on file://, the app must be served
 * over http (see serve.ps1) rather than opened directly.
 *
 * window.glyphsReady is a promise that resolves once everything is loaded.
 */
(function () {
  var ser = new XMLSerializer();

  // Pull the drawable elements out of a standalone glyph SVG (drop the wrapper,
  // its <style>, and any editor cruft). The result is the old "body" string.
  function extractBody(svgText) {
    var doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    var svg = doc.querySelector('svg');
    if (!svg) return '';
    var skip = { style: 1, defs: 1, title: 1, metadata: 1, script: 1 };
    var out = '';
    for (var i = 0; i < svg.children.length; i++) {
      var el = svg.children[i];
      if (skip[el.tagName.toLowerCase()]) continue;
      out += ser.serializeToString(el)
        .replace(/ xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '');
    }
    return out;
  }

  function getText(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ' -> HTTP ' + r.status);
      return r.text();
    });
  }

  window.glyphsReady = getText('glyph-data.json')
    .then(function (txt) { return JSON.parse(txt); })
    .then(function (data) {
      window.TWO_CHAR_TOKENS = data.twoCharTokens;
      window.ONE_CHAR_TOKENS = data.oneCharTokens;
      window.ALIASES = data.aliases;
      window.CHART_GROUPS = data.chartGroups;

      var glyphs = {};
      return Promise.all(data.glyphs.map(function (entry) {
        return getText('glyphs/' + entry.file).then(function (svgText) {
          glyphs[entry.token] = {
            kind: entry.kind,
            nucleus: !!entry.nucleus,
            height: entry.height,
            label: entry.label,
            sound: entry.sound,
            ipa: entry.ipa || '',
            body: extractBody(svgText)
          };
        });
      })).then(function () {
        window.GLYPHS = glyphs;
        return glyphs;
      });
    })
    .catch(function (err) {
      console.error('Failed to load glyphs:', err);
      var out = document.getElementById('output');
      if (out) {
        out.innerHTML = '<p style="color:#b02525;padding:12px">Could not load glyph data (' +
          String(err.message || err) + ').<br>This app reads files over http &mdash; ' +
          'run <code>serve.ps1</code> and open the served URL instead of the file directly.</p>';
      }
      throw err;
    });
})();
