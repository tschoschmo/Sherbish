/*
 * Document -> SVG.
 *
 * Layout model (all in "world units", 1 cell = 100):
 *   - A syllable is a block, two cells tall. With n glyphs it has
 *     cols = ceil(n/2) columns. The top row fills all columns; the bottom row
 *     holds the rest, horizontally centered under the top row.
 *   - A syllable of a single glyph is one column wide and stretched to the full
 *     two-cell height so it still reads as a full block.
 *   - Each glyph fills its cell, then is pushed into a vertical band by its
 *     height class (full / high=top half / low=bottom half / mid=center band).
 *   - Syllables in a word sit adjacent (small gap). Words are separated by the
 *     filled divider dot. Sentence punctuation renders as its own glyph.
 *   - Boxes flow onto lines and wrap at a max width. With IPA on, each line
 *     reserves a strip beneath it for the per-syllable transcription.
 */
(function () {
  var CELL = 100;
  var PAD = 6;                  // padding inside each cell
  var DRAW_MARGIN = 14;         // glyph art nominally sits in [14,86]; map that span to the cell so glyphs nearly fill it
  var SYL_GAP = 16;             // gap between syllables in a word
  var WORD_DOT_R = 5;           // radius of the word-divider dot
  var WORD_PAD = 10;            // space on each side of the divider dot
  var PUNCT_GAP = 12;           // gap before a punctuation glyph
  var MARGIN = 34;              // margin around the whole drawing
  var LINE_GAP = 40;            // vertical gap between wrapped lines
  var LINE_H = 2 * CELL;        // a line is two cells tall
  var IPA_H = 44;               // strip reserved under a line for IPA captions
  var IPA_DY = 34;              // caption baseline, below the bottom of the line

  function fmt(n) { return Math.round(n * 1000) / 1000; }

  function blockDims(n) {
    // Every block is two cells tall; a lone glyph stretches to fill it.
    if (n <= 1) return { cols: 1, rows: 2 };
    return { cols: Math.ceil(n / 2), rows: 2 };
  }

  function wordWidth(syllables) {
    var w = 0;
    for (var i = 0; i < syllables.length; i++) {
      if (i > 0) w += SYL_GAP;
      w += blockDims(syllables[i].length).cols * CELL;
    }
    return w;
  }

  function syllableIpa(tokens) {
    var s = '';
    for (var i = 0; i < tokens.length; i++) {
      var g = window.GLYPHS[tokens[i]];
      if (g && g.ipa) s += g.ipa;
    }
    return s;
  }

  function guideCell(x, y, w, h) {
    return '<rect class="guide-cell" x="' + fmt(x) + '" y="' + fmt(y) +
      '" width="' + fmt(w) + '" height="' + fmt(h) + '"/>';
  }

  // One glyph, scaled into a cell (cellW x cellH) and pushed into its band.
  function placeGlyph(token, cellX, cellY, cellW, cellH) {
    cellW = cellW == null ? CELL : cellW;
    cellH = cellH == null ? CELL : cellH;
    var g = window.GLYPHS[token];
    if (!g) return '';
    var innerX = cellX + PAD;
    var innerW = cellW - 2 * PAD;
    var innerY = cellY + PAD;
    var innerH = cellH - 2 * PAD;
    var bandY = innerY, bandH = innerH;
    if (g.height === 'high') { bandH = innerH * 0.5; }
    else if (g.height === 'low') { bandY = innerY + innerH * 0.5; bandH = innerH * 0.5; }
    else if (g.height === 'mid') { bandY = innerY + innerH * 0.30; bandH = innerH * 0.40; }
    var span = 100 - 2 * DRAW_MARGIN;
    var sx = innerW / span, sy = bandH / span;
    var tx = innerX - DRAW_MARGIN * sx;
    var ty = bandY - DRAW_MARGIN * sy;
    return '<g transform="translate(' + fmt(tx) + ',' + fmt(ty) +
      ') scale(' + fmt(sx) + ',' + fmt(sy) + ')">' + g.body + '</g>';
  }

  function renderSyllable(tokens, x, y, guides) {
    var n = tokens.length;
    if (n === 0) return '';
    var out = '';
    if (n === 1) {
      // Lone glyph: one column, stretched to the full two-cell height.
      if (guides) out += guideCell(x, y, CELL, 2 * CELL);
      out += placeGlyph(tokens[0], x, y, CELL, 2 * CELL);
      return out;
    }
    var cols = Math.ceil(n / 2);
    var top = cols;                                  // top row fills all columns
    var bottom = n - top;                            // remainder on the bottom row
    var bottomOffset = (cols - bottom) / 2 * CELL;   // center the shorter row
    for (var idx = 0; idx < n; idx++) {
      var cx, cy;
      if (idx < top) { cx = x + idx * CELL; cy = y; }
      else { cx = x + bottomOffset + (idx - top) * CELL; cy = y + CELL; }
      if (guides) out += guideCell(cx, cy, CELL, CELL);
      out += placeGlyph(tokens[idx], cx, cy, CELL, CELL);
    }
    return out;
  }

  // Build the flat list of flowable boxes.
  function buildBoxes(items, opts) {
    var guides = !!opts.guides;
    var ipa = !!opts.ipa;
    var boxes = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.type === 'word') {
        (function (syllables) {
          var w = wordWidth(syllables);
          boxes.push({
            kind: 'word', width: w,
            draw: function (x, lineTop) {
              var out = '', cx = x;
              for (var s = 0; s < syllables.length; s++) {
                var syll = syllables[s];
                var d = blockDims(syll.length);
                var bw = d.cols * CELL, bh = d.rows * CELL;
                if (s > 0) cx += SYL_GAP;
                var by = lineTop + (LINE_H - bh) / 2;
                if (guides) out += '<rect class="guide-block" x="' + fmt(cx) + '" y="' + fmt(by) + '" width="' + fmt(bw) + '" height="' + fmt(bh) + '"/>';
                out += renderSyllable(syll, cx, by, guides);
                if (ipa) {
                  var ip = syllableIpa(syll);
                  if (ip) out += '<text class="ipa" text-anchor="middle" x="' + fmt(cx + bw / 2) + '" y="' + fmt(lineTop + LINE_H + IPA_DY) + '">' + escapeXml(ip) + '</text>';
                }
                cx += bw;
              }
              return out;
            }
          });
        })(item.syllables);
      } else if (item.type === 'space') {
        boxes.push({
          kind: 'space', width: WORD_PAD * 2 + WORD_DOT_R * 2,
          draw: function (x, lineTop) {
            var cx = x + WORD_PAD + WORD_DOT_R;
            var cy = lineTop + LINE_H / 2;
            return '<circle class="fill" cx="' + fmt(cx) + '" cy="' + fmt(cy) + '" r="' + WORD_DOT_R + '"/>';
          }
        });
      } else if (item.type === 'punct') {
        (function (glyph) {
          boxes.push({
            kind: 'punct', width: PUNCT_GAP + CELL,
            draw: function (x, lineTop) {
              return placeGlyph(glyph, x + PUNCT_GAP, lineTop, CELL, 2 * CELL);
            }
          });
        })(item.glyph);
      } else if (item.type === 'error') {
        (function (raw) {
          boxes.push({
            kind: 'error', width: 2 * CELL,
            draw: function (x, lineTop) {
              var by = lineTop + (LINE_H - CELL) / 2;
              return '<rect class="err-box" x="' + (x + 6) + '" y="' + by + '" width="' + (2 * CELL - 12) + '" height="' + CELL + '"/>' +
                '<text class="err-text" x="' + (x + CELL) + '" y="' + (by + CELL / 2) + '">?' + escapeXml(raw) + '?</text>';
            }
          });
        })(item.raw);
      }
    }
    return boxes;
  }

  function escapeXml(s) {
    return String(s).replace(/[<>&"]/g, function (c) {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c];
    });
  }

  function renderDocument(items, opts) {
    opts = opts || {};
    var ipa = !!opts.ipa;
    var maxWidth = opts.maxWidth || 1500;        // world units before wrapping
    var boxes = buildBoxes(items, opts);
    var lineStep = LINE_H + (ipa ? IPA_H : 0) + LINE_GAP;

    var x = MARGIN, lineTop = MARGIN, maxX = MARGIN;
    var parts = [];
    for (var i = 0; i < boxes.length; i++) {
      var box = boxes[i];
      // Don't start a line with a divider dot.
      if (box.kind === 'space' && x === MARGIN) continue;
      // Wrap before a content box that would overflow.
      if (box.kind !== 'space' && x > MARGIN && x + box.width > maxWidth + MARGIN) {
        x = MARGIN;
        lineTop += lineStep;
      }
      parts.push(box.draw(x, lineTop));
      x += box.width;
      if (x > maxX) maxX = x;
    }

    var totalW = maxX + MARGIN;
    var totalH = lineTop + LINE_H + (ipa ? IPA_H : 0) + MARGIN;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" class="sherb" ' +
      'viewBox="0 0 ' + fmt(totalW) + ' ' + fmt(totalH) + '" ' +
      'preserveAspectRatio="xMinYMin meet">' + parts.join('') + '</svg>';
    return { svg: svg, width: totalW, height: totalH };
  }

  window.renderDocument = renderDocument;

  // Render a single glyph centered in its own small SVG (used by the chart).
  window.renderGlyphTile = function (token) {
    var g = window.GLYPHS[token];
    if (!g) return '';
    var inner = placeGlyph(token, 0, 0, CELL, CELL);
    return '<svg xmlns="http://www.w3.org/2000/svg" class="sherb tile" viewBox="0 0 ' + CELL + ' ' + CELL + '">' +
      '<rect class="tile-box" x="2" y="2" width="' + (CELL - 4) + '" height="' + (CELL - 4) + '"/>' +
      inner + '</svg>';
  };
})();
