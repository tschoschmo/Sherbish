/*
 * Single source of truth for the Sherbish script's visual style.
 *
 * The rendered SVG carries only class names (.sherb, .fill, .ipa, ...); the
 * actual look is supplied by these CSS rules. They're shared by two consumers:
 *   - the on-page preview (app.js injects them into the document), and
 *   - the standalone SVG download (app.js bakes them into the file as a
 *     <style> element so it renders the same without the page).
 */
(function () {
  // Concrete colors (no CSS custom properties) so the rules work embedded in a
  // downloaded SVG that has no access to the page's :root variables.
  var COLORS = {
    ink: '#15171a',
    muted: '#6b7280',
    line: '#e6e9ee',
    err: '#b02525',
    guideCell: '#eef1f5',
    guideBlockFill: 'rgba(59,111,255,.05)',
    guideBlockStroke: '#cddcff',
    errBoxFill: 'rgba(176,37,37,.07)'
  };

  // CSS that styles a `.sherb` SVG.
  //   opts.colors        - override the palette above.
  //   opts.scalingStroke - when true the 6-unit stroke scales with the artwork
  //                        (right for a downloadable file, faithful at any size);
  //                        when false it stays a constant 6px via
  //                        non-scaling-stroke (right for the live preview).
  function sherbCss(opts) {
    opts = opts || {};
    var c = opts.colors || COLORS;
    var ve = opts.scalingStroke ? '' : 'vector-effect:non-scaling-stroke;';
    return [
      '.sherb path,.sherb line,.sherb circle,.sherb ellipse,.sherb polygon,.sherb polyline{' +
        'fill:none;stroke:' + c.ink + ';stroke-width:6;stroke-linecap:round;stroke-linejoin:round;' + ve + '}',
      '.sherb .fill{fill:' + c.ink + ';stroke:none;}',
      '.sherb .guide-cell{fill:none;stroke:' + c.guideCell + ';stroke-width:1.5;}',
      '.sherb .guide-block{fill:' + c.guideBlockFill + ';stroke:' + c.guideBlockStroke + ';stroke-width:2;}',
      '.sherb .err-box{fill:' + c.errBoxFill + ';stroke:' + c.err + ';stroke-width:3;stroke-dasharray:9 6;}',
      '.sherb .err-text{fill:' + c.err + ';stroke:none;font:700 26px ui-monospace,monospace;text-anchor:middle;dominant-baseline:middle;}',
      '.sherb .ipa{fill:' + c.muted + ';stroke:none;font:400 30px "Segoe UI","Charis SIL","Doulos SIL","Gentium Plus",system-ui,sans-serif;}',
      '.sherb.tile .tile-box{fill:none;stroke:' + c.line + ';stroke-width:2;}'
    ].join('\n');
  }

  window.SHERB_COLORS = COLORS;
  window.sherbCss = sherbCss;
})();
