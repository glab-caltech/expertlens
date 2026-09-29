// Interactive version of blog Fig. 4: expert-set overlap vs. WordNet distance for Tiny ImageNet class pairs.
// Data: static/data/semantic_pairs_qwen.json (see MoE_interp_clean/interactive_visuals/export_semantic_pairs_data.py)
(() => {
  const figure = document.getElementById('semantic-pairs-figure');
  if (!figure) return;
  const fallbackImg = figure.querySelector('img');
  const ns = 'http://www.w3.org/2000/svg';
  const THUMB_DIR = 'static/figures/tinyimagenet/';
  const SCATTER_COLOR = '#A8C97A';
  const FIT_COLOR = '#5C9E2F';
  const OTHER_COLOR = '#444';
  const CONTROL_COLOR = '#808080';
  const W = 700;
  const H = 328;
  const A = { left: 52, right: 322, top: 34, bottom: 248 };
  const B = { left: 392, right: 690, top: 34, bottom: 248 };

  function element(tag, attributes = {}, parent, content) {
    const child = document.createElementNS(ns, tag);
    Object.entries(attributes).forEach(([name, value]) => child.setAttribute(name, value));
    if (content !== undefined) child.textContent = content;
    if (parent) parent.appendChild(child);
    return child;
  }
  function text(parent, value, x, y, className, anchor = 'start', extra = {}) {
    return element('text', { x, y, class: className, 'text-anchor': anchor, ...extra }, parent, value);
  }
  function html(tag, className, parent, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    if (parent) parent.appendChild(node);
    return node;
  }
  function hexToRgba(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  function pairKey(a, b) { return [a, b].sort().join('|'); }

  function build(data) {
    const classes = data.classes;
    const classByKey = new Map(classes.map(c => [c.key, c]));
    const pairs = new Map(data.pairs.map(p => [pairKey(p.a, p.b), p]));
    const layers = data.layers;
    // Match zscore_aggregate_everyother.png: every other MoE layer.
    const layerIdx = layers.map((_, i) => i).filter(i => i % 2 === 0);
    const plotLayers = layerIdx.map(i => layers[i]);

    // ----- scales -----
    const sc = data.scatter;
    const axMin = 0, axMax = 1;
    const ayMin = Math.floor(Math.min(...sc.y)), ayMax = Math.ceil(Math.max(...sc.y));
    const ax = v => A.left + (v - axMin) / (axMax - axMin) * (A.right - A.left);
    const ay = v => A.bottom - (v - ayMin) / (ayMax - ayMin) * (A.bottom - A.top);
    let byMin = Infinity, byMax = -Infinity;
    data.pairs.forEach(p => layerIdx.forEach(i => {
      byMin = Math.min(byMin, p.z_by_layer_mean[i] - p.z_by_layer_std[i]);
      byMax = Math.max(byMax, p.z_by_layer_mean[i] + p.z_by_layer_std[i]);
    }));
    data.control_by_layer.forEach(v => { byMin = Math.min(byMin, v); byMax = Math.max(byMax, v); });
    byMin = Math.floor(byMin); byMax = Math.ceil(byMax);
    const bxMin = plotLayers[0], bxMax = plotLayers[plotLayers.length - 1];
    const bx = v => B.left + (v - bxMin) / (bxMax - bxMin) * (B.right - B.left);
    const by = v => B.bottom - (v - byMin) / (byMax - byMin) * (B.bottom - B.top);

    const wrap = html('div', 'iv-figure iv-semantic');
    const chartWrap = html('div', 'iv-sem-wrap', wrap);
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    chartWrap.appendChild(canvas);
    const svg = element('svg', {
      class: 'iv-chart',
      viewBox: `0 0 ${W} ${H}`,
      role: 'img',
      'aria-label': 'Interactive chart. Left: expert-set overlap Z-score versus WordNet Wu-Palmer distance for all Tiny ImageNet class pairs, with the selected pair highlighted. Right: Z-score by layer for the selected pair and the five related pairs, against the unrelated-pair baseline.'
    }, chartWrap);

    // ----- Panel A (axes, fit, markers; points are on the canvas) -----
    text(svg, '(A)', 8, 22, 'iv-panel-letter');
    text(svg, `Semantic specialization (n = ${(sc.n / 1000).toFixed(1)}K pairs)`, (A.left + A.right) / 2, 24, 'iv-panel-title', 'middle');
    for (let v = ayMin; v <= ayMax; v++) {
      element('line', { x1: A.left, x2: A.right, y1: ay(v), y2: ay(v), class: 'iv-grid' }, svg);
      text(svg, String(v), A.left - 6, ay(v) + 3, 'iv-tick', 'end');
    }
    [0.2, 0.4, 0.6, 0.8].forEach(v => {
      element('line', { x1: ax(v), x2: ax(v), y1: A.top, y2: A.bottom, class: 'iv-grid' }, svg);
      text(svg, v.toFixed(1), ax(v), A.bottom + 13, 'iv-tick', 'middle');
    });
    element('line', { x1: A.left, x2: A.right, y1: ay(0), y2: ay(0), stroke: '#9a9a9a', 'stroke-dasharray': '4 3' }, svg);
    const markersA = element('g', {}, svg);
    element('line', { x1: ax(Math.min(...sc.x)), x2: ax(Math.max(...sc.x)), y1: ay(sc.intercept + sc.slope * Math.min(...sc.x)), y2: ay(sc.intercept + sc.slope * Math.max(...sc.x)), stroke: FIT_COLOR, 'stroke-width': 2.4 }, svg);
    element('rect', { x: A.left, y: A.top, width: A.right - A.left, height: A.bottom - A.top, class: 'iv-frame' }, svg);
    text(svg, 'WordNet Wu-Palmer distance', (A.left + A.right) / 2, A.bottom + 27, 'iv-axis-title', 'middle');
    text(svg, 'Z(a,b)', 18, (A.top + A.bottom) / 2, 'iv-axis-title', 'middle', { transform: `rotate(-90 18 ${(A.top + A.bottom) / 2})` });
    const statBox = element('g', {}, svg);
    element('rect', { x: A.left + 8, y: A.bottom - 24, width: 118, height: 17, fill: '#fff', stroke: '#bbb', 'stroke-width': .8 }, statBox);
    text(statBox, `Pearson r = ${sc.pearson_r.toFixed(3)}***`, A.left + 14, A.bottom - 12, 'iv-note');
    const selectedA = element('g', {}, svg);

    // ----- Panel B -----
    text(svg, '(B)', 348, 22, 'iv-panel-letter');
    text(svg, 'Expert specialization by object semantics (n = 10)', (B.left + B.right) / 2, 24, 'iv-panel-title', 'middle');
    for (let v = byMin; v <= byMax; v++) {
      element('line', { x1: B.left, x2: B.right, y1: by(v), y2: by(v), class: 'iv-grid' }, svg);
      text(svg, String(v), B.left - 6, by(v) + 3, 'iv-tick', 'end');
    }
    for (let v = 0; v <= bxMax; v += 10) {
      element('line', { x1: bx(v), x2: bx(v), y1: B.top, y2: B.bottom, class: 'iv-grid' }, svg);
      text(svg, String(v), bx(v), B.bottom + 13, 'iv-tick', 'middle');
    }
    const bandsB = element('g', {}, svg);
    const linesB = element('g', {}, svg);
    element('rect', { x: B.left, y: B.top, width: B.right - B.left, height: B.bottom - B.top, class: 'iv-frame' }, svg);
    text(svg, 'Layer index', (B.left + B.right) / 2, B.bottom + 27, 'iv-axis-title', 'middle');
    text(svg, 'Z(a,b)', 360, (B.top + B.bottom) / 2, 'iv-axis-title', 'middle', { transform: `rotate(-90 360 ${(B.top + B.bottom) / 2})` });
    // Control baseline (unrelated pairs).
    const ctrlPath = layerIdx.map((i, k) => `${k ? 'L' : 'M'}${bx(layers[i]).toFixed(1)} ${by(data.control_by_layer[i]).toFixed(1)}`).join(' ');
    element('path', { d: ctrlPath, class: 'iv-sem-line', stroke: CONTROL_COLOR, 'stroke-dasharray': '5 4', 'stroke-width': 1.6 }, linesB);
    element('title', {}, linesB.lastChild, 'other pairs (mean of unrelated class pairs)');
    // Legend row under both panels.
    const legend = element('g', {}, svg);
    const groups = [...new Set(classes.map(c => c.group))];
    let legendX = A.left;
    const legendY = 310;
    groups.concat(['other pairs']).forEach(g => {
      const isOther = g === 'other pairs';
      const color = isOther ? CONTROL_COLOR : classes.find(c => c.group === g).color;
      element('line', { x1: legendX, x2: legendX + 20, y1: legendY - 4, y2: legendY - 4, stroke: color, 'stroke-width': isOther ? 1.6 : 2.6, ...(isOther ? { 'stroke-dasharray': '4 3' } : {}) }, legend);
      text(legend, g, legendX + 26, legendY, 'iv-legend');
      // Fixed advance (~6.3 px per character at 11 px) so layout does not depend on
      // measuring text before the SVG is attached to the document.
      legendX += 26 + Math.ceil(g.length * 6.3) + 22;
    });

    function pathFor(pair) {
      return layerIdx.map((i, k) => `${k ? 'L' : 'M'}${bx(layers[i]).toFixed(1)} ${by(pair.z_by_layer_mean[i]).toFixed(1)}`).join(' ');
    }
    function bandFor(pair) {
      const upper = layerIdx.map((i, k) => `${k ? 'L' : 'M'}${bx(layers[i]).toFixed(1)} ${by(pair.z_by_layer_mean[i] + pair.z_by_layer_std[i]).toFixed(1)}`);
      const lower = layerIdx.slice().reverse().map(i => `L${bx(layers[i]).toFixed(1)} ${by(pair.z_by_layer_mean[i] - pair.z_by_layer_std[i]).toFixed(1)}`);
      return upper.concat(lower).join(' ') + ' Z';
    }
    const semanticPairs = data.pairs.filter(p => p.semantic);
    const semanticElements = semanticPairs.map(pair => {
      const color = classByKey.get(pair.a).color;
      const shade = classByKey.get(pair.a).shade;
      const band = element('path', { d: bandFor(pair), class: 'iv-sem-band', fill: shade, opacity: .45 }, bandsB);
      const line = element('path', { d: pathFor(pair), class: 'iv-sem-line', stroke: color }, linesB);
      element('title', {}, line, `${classByKey.get(pair.a).name} & ${classByKey.get(pair.b).name}`);
      const ring = element('circle', { cx: ax(pair.wup_distance), cy: ay(pair.z_agg), r: 5, fill: 'none', stroke: color, 'stroke-width': 2, class: 'iv-sem-marker' }, markersA);
      element('title', {}, ring, `${classByKey.get(pair.a).name} & ${classByKey.get(pair.b).name}: d = ${pair.wup_distance.toFixed(2)}, Z = ${pair.z_agg.toFixed(2)}`);
      return { pair, band, line, ring };
    });
    const customBand = element('path', { class: 'iv-sem-band', fill: '#000', opacity: 0 }, bandsB);
    const customLine = element('path', { class: 'iv-sem-line', stroke: OTHER_COLOR, opacity: 0 }, linesB);

    // ----- canvas scatter -----
    function drawScatter() {
      const width = chartWrap.clientWidth || W;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(width * H / W * dpr);
      const ctx = canvas.getContext('2d');
      const s = canvas.width / W;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = SCATTER_COLOR;
      for (let i = 0; i < sc.x.length; i++) {
        ctx.beginPath();
        ctx.arc(ax(sc.x[i]) * s, ay(sc.y[i]) * s, 2.2 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ----- class picker -----
    const status = html('div', 'iv-status', wrap, '');
    const picker = html('div', 'iv-classes', wrap);
    picker.setAttribute('role', 'group');
    picker.setAttribute('aria-label', 'Pick two Tiny ImageNet classes');
    const buttons = new Map();
    groups.forEach(g => {
      const members = classes.filter(c => c.group === g);
      const box = html('div', 'iv-class-group', picker);
      box.style.setProperty('--group-color', members[0].color);
      box.style.setProperty('--group-bg', hexToRgba(members[0].color, 0.14));
      html('h4', '', box, g);
      members.forEach(c => {
        const button = html('button', 'iv-class', box);
        button.type = 'button';
        button.setAttribute('aria-pressed', 'false');
        if (c.thumbs && c.thumbs.length) {
          const img = document.createElement('img');
          img.src = THUMB_DIR + c.thumbs[0];
          img.alt = '';
          img.width = 36;
          img.height = 36;
          img.loading = 'lazy';
          button.appendChild(img);
        }
        html('span', '', button, c.name);
        button.addEventListener('click', () => toggle(c.key));
        buttons.set(c.key, button);
      });
    });

    let selected = [];
    function toggle(key) {
      if (selected.includes(key)) selected = selected.filter(k => k !== key);
      else selected = selected.length >= 2 ? [selected[1], key] : selected.concat(key);
      update();
    }
    function update() {
      buttons.forEach((button, key) => {
        const on = selected.includes(key);
        button.classList.toggle('is-selected', on);
        button.setAttribute('aria-pressed', String(on));
      });
      selectedA.replaceChildren();
      const pair = selected.length === 2 ? pairs.get(pairKey(selected[0], selected[1])) : null;
      const semanticIdx = pair ? semanticElements.findIndex(e => e.pair === pair) : -1;
      semanticElements.forEach((e, i) => {
        const focus = !pair || i === semanticIdx;
        e.line.style.opacity = focus ? 1 : 0.18;
        e.line.style.strokeWidth = pair && i === semanticIdx ? 3 : 2;
        e.band.style.opacity = !pair ? 0.45 : i === semanticIdx ? 0.55 : 0;
        e.ring.style.opacity = focus ? 1 : 0.25;
      });
      if (!pair) {
        customLine.style.opacity = 0;
        customBand.style.opacity = 0;
        status.textContent = selected.length === 1
          ? `Selected ${classByKey.get(selected[0]).name}. Pick one more class to see its pair.`
          : 'Click any two classes below to see where that pair falls on (A) and its per-layer overlap on (B).';
        return;
      }
      const a = classByKey.get(pair.a), b = classByKey.get(pair.b);
      const color = pair.semantic ? a.color : OTHER_COLOR;
      if (!pair.semantic) {
        customLine.setAttribute('d', pathFor(pair));
        customBand.setAttribute('d', bandFor(pair));
        customLine.style.opacity = 1;
        customLine.style.strokeWidth = 3;
        customBand.style.opacity = 0.12;
      } else {
        customLine.style.opacity = 0;
        customBand.style.opacity = 0;
      }
      const cx = ax(pair.wup_distance), cy = ay(pair.z_agg);
      element('circle', { cx, cy, r: 9, fill: 'none', stroke: color, 'stroke-width': 1.2, opacity: .6 }, selectedA);
      element('circle', { cx, cy, r: 5, fill: color, stroke: '#fff', 'stroke-width': 1.5 }, selectedA);
      const labelText = `${a.name} & ${b.name}`;
      const labelRight = cx < (A.left + A.right) / 2;
      const lx = labelRight ? cx + 12 : cx - 12;
      const ly = cy < A.top + 24 ? cy + 16 : cy - 10;
      const bg = element('rect', { fill: '#fff', stroke: color, 'stroke-width': .8, rx: 2, opacity: .92 }, selectedA);
      const label = text(selectedA, labelText, lx, ly, 'iv-note', labelRight ? 'start' : 'end', { fill: '#111' });
      const bbox = label.getBBox();
      bg.setAttribute('x', bbox.x - 4); bg.setAttribute('y', bbox.y - 2);
      bg.setAttribute('width', bbox.width + 8); bg.setAttribute('height', bbox.height + 4);
      const relation = pair.semantic ? 'a related pair' : 'not one of the five related pairs';
      status.innerHTML = `<b>${a.name} &amp; ${b.name}</b> (${relation}): Wu-Palmer distance <b>${pair.wup_distance.toFixed(2)}</b>, expert-set overlap Z = <b>${pair.z_agg.toFixed(2)}</b> across all 200 classes. (B) shows this pair's Z-score by layer (mean ± 1 s.d. over patch cutoffs).`;
    }

    figure.insertBefore(wrap, figure.firstChild);
    if (fallbackImg) fallbackImg.classList.add('iv-hidden');
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(drawScatter).observe(chartWrap);
    else addEventListener('resize', drawScatter);
    drawScatter();
    update();
  }

  // Data is normally preloaded by a <script src="static/data/semantic_pairs_qwen.js"> tag (works from file://);
  // fetch() is only a fallback for hosted builds where that tag is absent.
  const preloaded = window.IV_DATA && window.IV_DATA['semantic_pairs_qwen'];
  if (preloaded) {
    build(preloaded);
  } else {
    fetch('static/data/semantic_pairs_qwen.json')
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(build)
      .catch(error => {
        console.warn('[semantic-pairs] falling back to static figure:', error);
      });
  }
})();
