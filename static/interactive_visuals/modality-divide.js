// Interactive version of blog Fig. 1: per-layer modality divide of Qwen3-VL experts.
// Data: static/data/modality_divide_qwen.json (see MoE_interp_clean/interactive_visuals/export_modality_olo_data.py)
(() => {
  const figure = document.getElementById('modality-divide-figure');
  if (!figure) return;
  const fallbackImg = figure.querySelector('img');
  const ns = 'http://www.w3.org/2000/svg';
  const IMAGE_COLOR = '#E67E22';
  const TEXT_COLOR = '#8753B5';
  const HIST_COLOR = '#BCD8EC';
  const HIST_EDGE = '#8fb8d8';
  const W = 700;
  const H = 330;
  const A = { left: 52, right: 446, top: 44, bottom: 244 };
  const B = { left: 522, right: 668, top: 60, bottom: 244 };
  const DEFAULT_LAYER = 40;

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
  function niceMax(value) {
    if (value <= 0) return 1;
    const exp = Math.pow(10, Math.floor(Math.log10(value)));
    const frac = value / exp;
    const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
    return nice * exp;
  }
  function layerHist(layer, edges) {
    const counts = new Array(edges.length - 1).fill(0);
    for (let e = 0; e < layer.image_hits.length; e++) {
      const img = layer.image_hits[e];
      const txt = layer.text_hits[e];
      const total = img + txt;
      if (total <= 0) continue;
      const share = 100 * txt / total;
      let bin = Math.floor(share / (edges[1] - edges[0]));
      if (bin >= counts.length) bin = counts.length - 1;
      counts[bin] += 1;
    }
    return counts;
  }

  function build(data) {
    const layers = data.layers;
    const byIndex = new Map(layers.map(layer => [layer.layer, layer]));
    const numExperts = data.num_experts;
    const edges = data.text_share_hist.bin_edges;
    const pooled = data.text_share_hist.counts;

    const wrap = html('div', 'iv-figure iv-modality');
    const svg = element('svg', {
      class: 'iv-chart',
      viewBox: `0 0 ${W} ${H}`,
      role: 'img',
      'aria-label': 'Interactive modality specialization chart. Left: per-expert share of image-patch versus text-token activations for the selected decoder layer, experts in optimal-leaf order. Right: histogram of text-activation share pooled over all layers, with the selected layer overlaid.'
    }, wrap);

    // ---------- Panel A: stacked bars ----------
    text(svg, '(A)', 8, 30, 'iv-panel-letter');
    const titleA = text(svg, '', (A.left + A.right) / 2, 32, 'iv-panel-title', 'middle');
    element('rect', { x: A.left, y: A.top, width: A.right - A.left, height: A.bottom - A.top, class: 'iv-frame' }, svg);
    const barsGroup = element('g', {}, svg);
    const slot = (A.right - A.left) / numExperts;
    const barW = slot * 0.82;
    const plotH = A.bottom - A.top;
    const bars = [];
    for (let i = 0; i < numExperts; i++) {
      const x = A.left + i * slot + (slot - barW) / 2;
      const img = element('rect', { x, width: barW, fill: IMAGE_COLOR, class: 'iv-mod-bar' }, barsGroup);
      const txt = element('rect', { x, width: barW, fill: TEXT_COLOR, class: 'iv-mod-bar' }, barsGroup);
      const title = element('title', {}, img);
      const title2 = element('title', {}, txt);
      bars.push({ img, txt, title, title2 });
    }
    // Axis labels with arrows (mirrors the paper's layout).
    const yLabelX = 22;
    element('line', { x1: yLabelX + 8, y1: A.bottom, x2: yLabelX + 8, y2: A.top + 40, class: 'iv-axis', 'marker-end': 'url(#iv-arrow)' }, svg);
    element('line', { x1: A.left, y1: A.bottom + 14, x2: A.left + 120, y2: A.bottom + 14, class: 'iv-axis', 'marker-end': 'url(#iv-arrow)' }, svg);
    const defs = element('defs', {}, svg);
    const marker = element('marker', { id: 'iv-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, defs);
    element('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#aab5bb' }, marker);
    text(svg, 'Text vs. image activations', yLabelX, (A.top + A.bottom) / 2, 'iv-axis-title', 'middle', { transform: `rotate(-90 ${yLabelX} ${(A.top + A.bottom) / 2})` });
    text(svg, 'Experts (OLO ordered)', A.left + 128, A.bottom + 18, 'iv-axis-title');
    // Legend
    const legendY = 300;
    element('rect', { x: A.left + 40, y: legendY - 10, width: 22, height: 11, fill: IMAGE_COLOR }, svg);
    text(svg, 'Image patches', A.left + 68, legendY, 'iv-legend');
    element('rect', { x: A.left + 176, y: legendY - 10, width: 22, height: 11, fill: TEXT_COLOR }, svg);
    text(svg, 'Text tokens', A.left + 204, legendY, 'iv-legend');
    element('rect', { x: A.left + 292, y: legendY - 10, width: 22, height: 11, fill: HIST_COLOR }, svg);
    text(svg, 'All layers pooled', A.left + 320, legendY, 'iv-legend');

    // ---------- Panel B: histogram ----------
    text(svg, '(B)', 478, 30, 'iv-panel-letter');
    text(svg, 'Modality specificity of experts', (B.left + B.right) / 2, 32, 'iv-panel-title', 'middle');
    text(svg, 'Hartigan dip = 0.0136, p < 0.001', (B.left + B.right) / 2, 47, 'iv-note', 'middle');
    const histH = B.bottom - B.top;
    const nBins = pooled.length;
    const binW = (B.right - B.left) / nBins;
    const pooledMax = niceMax(Math.max(...pooled));
    // Grid + left axis (pooled)
    const leftTicks = 5;
    for (let t = 0; t <= leftTicks; t++) {
      const v = pooledMax * t / leftTicks;
      const y = B.bottom - v / pooledMax * histH;
      element('line', { x1: B.left, x2: B.right, y1: y, y2: y, class: 'iv-grid' }, svg);
      text(svg, String(Math.round(v)), B.left - 5, y + 3, 'iv-tick', 'end');
    }
    const pooledBars = [];
    for (let b = 0; b < nBins; b++) {
      const h = pooled[b] / pooledMax * histH;
      pooledBars.push(element('rect', {
        x: B.left + b * binW + 0.5, y: B.bottom - h, width: binW - 1, height: h,
        fill: HIST_COLOR, stroke: HIST_EDGE, 'stroke-width': .5
      }, svg));
    }
    element('rect', { x: B.left, y: B.top, width: B.right - B.left, height: histH, class: 'iv-frame' }, svg);
    [0, 20, 40, 60, 80, 100].forEach(v => {
      const x = B.left + v / 100 * (B.right - B.left);
      text(svg, String(v), x, B.bottom + 12, 'iv-tick', 'middle');
    });
    text(svg, 'Relative text activation frequency (%)', (B.left + B.right) / 2, B.bottom + 26, 'iv-axis-title', 'middle');
    text(svg, '# of experts (all layers)', 494, (B.top + B.bottom) / 2, 'iv-axis-title', 'middle', { transform: `rotate(-90 494 ${(B.top + B.bottom) / 2})` });
    // Right axis for the selected layer overlay.
    const perLayerMax = niceMax(Math.max(...layers.map(layer => Math.max(...layerHist(layer, edges)))));
    for (let t = 0; t <= leftTicks; t++) {
      const v = perLayerMax * t / leftTicks;
      const y = B.bottom - v / perLayerMax * histH;
      text(svg, String(Math.round(v)), B.right + 5, y + 3, 'iv-tick', 'start', { fill: TEXT_COLOR });
    }
    const rightLabel = text(svg, '', 694, (B.top + B.bottom) / 2, 'iv-axis-title', 'middle', { transform: `rotate(90 694 ${(B.top + B.bottom) / 2})`, fill: TEXT_COLOR });
    const layerLine = element('path', { fill: 'none', stroke: TEXT_COLOR, 'stroke-width': 1.8, 'stroke-linejoin': 'round', opacity: .5 }, svg);
    const layerDots = element('g', { opacity: .5 }, svg);

    // ---------- Controls ----------
    const controls = html('div', 'iv-controls', wrap);
    html('span', '', controls, 'Decoder layer');
    const prev = html('button', 'iv-btn', controls, '‹');
    prev.type = 'button';
    prev.setAttribute('aria-label', 'Previous layer');
    const range = document.createElement('input');
    range.type = 'range';
    range.className = 'iv-range';
    range.min = String(layers[0].layer);
    range.max = String(layers[layers.length - 1].layer);
    range.step = '1';
    range.setAttribute('aria-label', 'Decoder layer');
    controls.appendChild(range);
    const next = html('button', 'iv-btn', controls, '›');
    next.type = 'button';
    next.setAttribute('aria-label', 'Next layer');
    const value = html('output', 'iv-value', controls, '');
    html('span', 'iv-spacer', controls);
    const quick = html('span', '', controls, 'Paper layers:');
    quick.style.color = 'var(--faint)';
    const quickButtons = [4, 24, 40].filter(l => byIndex.has(l)).map(l => {
      const button = html('button', 'iv-btn', controls, String(l));
      button.type = 'button';
      button.addEventListener('click', () => setLayer(l));
      return { layer: l, button };
    });

    let current = byIndex.has(DEFAULT_LAYER) ? DEFAULT_LAYER : layers[0].layer;

    function render() {
      const layer = byIndex.get(current);
      titleA.textContent = `Layer ${current}`;
      value.textContent = `Layer ${current}`;
      range.value = String(current);
      prev.disabled = current <= Number(range.min);
      next.disabled = current >= Number(range.max);
      quickButtons.forEach(({ layer: l, button }) => button.classList.toggle('is-active', l === current));
      rightLabel.textContent = `# of experts (layer ${current})`;
      layer.order.forEach((expertId, position) => {
        const img = layer.image_hits[expertId];
        const txt = layer.text_hits[expertId];
        const total = img + txt;
        const imgFrac = total > 0 ? img / total : 0.5;
        const imgH = imgFrac * plotH;
        const bar = bars[position];
        bar.img.style.y = `${A.bottom - imgH}px`;
        bar.img.style.height = `${imgH}px`;
        bar.txt.style.y = `${A.top}px`;
        bar.txt.style.height = `${plotH - imgH}px`;
        const tip = `Expert ${expertId} · image ${(100 * imgFrac).toFixed(0)}% · text ${(100 * (1 - imgFrac)).toFixed(0)}% (${img.toLocaleString()} / ${txt.toLocaleString()} hits)`;
        bar.title.textContent = tip;
        bar.title2.textContent = tip;
      });
      const counts = layerHist(layer, edges);
      const points = counts.map((c, b) => {
        const x = B.left + (b + 0.5) * binW;
        const y = B.bottom - c / perLayerMax * histH;
        return [x, y];
      });
      layerLine.setAttribute('d', points.map((pt, i) => `${i ? 'L' : 'M'}${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`).join(' '));
      layerDots.replaceChildren();
      points.forEach(([x, y], b) => {
        const dot = element('circle', { cx: x, cy: y, r: 2.2, fill: TEXT_COLOR }, layerDots);
        element('title', {}, dot, `${edges[b]}–${edges[b + 1]}% text: ${counts[b]} experts in layer ${current}`);
      });
    }
    function setLayer(l) {
      const clamped = Math.max(Number(range.min), Math.min(Number(range.max), l));
      if (!byIndex.has(clamped)) return;
      current = clamped;
      render();
    }
    range.addEventListener('input', () => setLayer(Number(range.value)));
    prev.addEventListener('click', () => setLayer(current - 1));
    next.addEventListener('click', () => setLayer(current + 1));

    figure.insertBefore(wrap, figure.firstChild);
    if (fallbackImg) fallbackImg.classList.add('iv-hidden');
    render();
  }

  // Data is normally preloaded by a <script src="static/data/modality_divide_qwen.js"> tag (works from file://);
  // fetch() is only a fallback for hosted builds where that tag is absent.
  const preloaded = window.IV_DATA && window.IV_DATA['modality_divide_qwen'];
  if (preloaded) {
    build(preloaded);
  } else {
    fetch('static/data/modality_divide_qwen.json')
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(build)
      .catch(error => {
        console.warn('[modality-divide] falling back to static figure:', error);
      });
  }
})();
