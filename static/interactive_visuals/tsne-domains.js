// Interactive version of blog Fig. 2: layer-18 t-SNE of router vectors, colored per dataset on click.
// Data: static/data/tsne_embedding_L18.json (see MoE_interp_clean/interactive_visuals/export_tsne_embedding.py)
(() => {
  const figure = document.getElementById('tsne-domains-figure');
  if (!figure) return;
  const fallbackImg = figure.querySelector('img');
  const DATA_URL = 'static/data/tsne_embedding_L18.json';
  const GRAY = '#d1d1d1';
  const ROUTER_EDGE = '#111';
  const PANEL_W = 480;
  const PANEL_H = 360;
  const DOMAIN_STYLE = {
    breast_histopathology: { label: 'breast_histo', color: '#238CC4', group: 'Medical' },
    medmnist_path: { label: 'medmnist', color: '#8AC4E8', group: 'Medical' },
    mathvista: { label: 'mathvista', color: '#E91E63', group: 'Math' },
    mathvision: { label: 'mathvision', color: '#FFCBE1', group: 'Math' },
    mmk12: { label: 'mmk12', color: '#FFCBE1', group: 'Math' },
    cosyn_400k: { label: 'cosyn_400k', color: '#FFCBE1', group: 'Math' },
    rsvqa_lr: { label: 'RSVQA_lr', color: '#E67E22', group: 'Remote Sensing' },
    rsvqa_hr: { label: 'RSVQA_hr', color: '#F8D2A0', group: 'Remote Sensing' }
  };
  const GROUP_ORDER = ['Medical', 'Math', 'Remote Sensing'];

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

  function build(data) {
    const domains = data.domains.filter(d => DOMAIN_STYLE[d]);
    const points = data.points;
    const router = data.router;
    const all = points.concat(router);
    const xs = all.map(p => p.x);
    const ys = all.map(p => p.y);
    const pad = 0.04;
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    const xr = x1 - x0 || 1, yr = y1 - y0 || 1;
    const xmin = x0 - pad * xr, xmax = x1 + pad * xr;
    const ymin = y0 - pad * yr, ymax = y1 + pad * yr;
    const sx = v => (v - xmin) / (xmax - xmin) * PANEL_W;
    const sy = v => PANEL_H - (v - ymin) / (ymax - ymin) * PANEL_H;
    const byDomainModality = new Map();
    points.forEach(p => {
      const key = `${p.d}:${p.m}`;
      if (!byDomainModality.has(key)) byDomainModality.set(key, []);
      byDomainModality.get(key).push(p);
    });

    const wrap = html('div', 'iv-figure iv-tsne');
    const canvasWrap = html('div', 'iv-canvas-wrap', wrap);
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Interactive t-SNE projection of layer ${data.layer} router activations. Image patches are circles, text tokens are crosses, expert router weights are triangles. Selected datasets are colored; everything else is gray.`);
    canvasWrap.appendChild(canvas);
    const title = html('div', 'iv-canvas-title', canvasWrap, `Layer ${data.layer} · image ○  text ×  router △`);
    const caption = html('div', 'iv-canvas-caption', canvasWrap, '');

    const side = html('div', 'iv-side', wrap);
    const active = new Set();
    let modality = 'both';
    let showRouter = true;
    const chips = new Map();
    GROUP_ORDER.forEach(group => {
      const members = domains.filter(d => DOMAIN_STYLE[d].group === group);
      if (!members.length) return;
      html('div', 'iv-group-title', side, group);
      members.forEach(d => {
        const style = DOMAIN_STYLE[d];
        const chip = html('button', 'iv-chip', side);
        chip.type = 'button';
        chip.setAttribute('aria-pressed', 'false');
        chip.style.setProperty('--chip-color', style.color);
        chip.style.setProperty('--chip-bg', hexToRgba(style.color, 0.18));
        html('i', '', chip);
        html('span', '', chip, style.label);
        chip.addEventListener('click', () => {
          if (active.has(d)) active.delete(d); else active.add(d);
          update();
        });
        chips.set(d, chip);
      });
    });
    html('div', 'iv-group-title', side, 'Show');
    const seg = html('div', 'iv-seg', side);
    const segButtons = [['both', 'Both'], ['image', 'Image'], ['text', 'Text']].map(([key, label]) => {
      const button = html('button', 'iv-btn', seg, label);
      button.type = 'button';
      button.addEventListener('click', () => { modality = key; update(); });
      return { key, button };
    });
    const routerChip = html('button', 'iv-chip', side);
    routerChip.type = 'button';
    routerChip.style.setProperty('--chip-color', '#555');
    routerChip.style.setProperty('--chip-bg', 'rgba(0,0,0,0.06)');
    html('i', '', routerChip);
    html('span', '', routerChip, 'Router weights (△)');
    routerChip.addEventListener('click', () => { showRouter = !showRouter; update(); });
    const row = html('div', 'iv-controls', side);
    const allButton = html('button', 'iv-btn', row, 'All datasets');
    allButton.type = 'button';
    allButton.addEventListener('click', () => { domains.forEach(d => active.add(d)); update(); });
    const clearButton = html('button', 'iv-btn', row, 'Clear');
    clearButton.type = 'button';
    clearButton.addEventListener('click', () => { active.clear(); update(); });

    let dpr = 1;
    function resize() {
      const width = canvasWrap.clientWidth || PANEL_W;
      const height = width * PANEL_H / PANEL_W;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.height = `${height}px`;
      draw();
    }

    function drawCircle(ctx, x, y, r) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    function drawCross(ctx, x, y, s) {
      ctx.beginPath();
      ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s);
      ctx.moveTo(x - s, y + s); ctx.lineTo(x + s, y - s);
      ctx.stroke();
    }
    function drawTriangle(ctx, x, y, s) {
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s * 0.95, y + s * 0.7);
      ctx.lineTo(x - s * 0.95, y + s * 0.7);
      ctx.closePath();
      ctx.stroke();
    }
    function drawLayer(ctx, list, kind, color, alpha, scale) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.1 * scale;
      if (kind === 'image') {
        list.forEach(p => drawCircle(ctx, sx(p.x) * scale, sy(p.y) * scale, 2.1 * scale));
      } else {
        list.forEach(p => drawCross(ctx, sx(p.x) * scale, sy(p.y) * scale, 2.4 * scale));
      }
    }
    function draw() {
      const ctx = canvas.getContext('2d');
      const scale = canvas.width / PANEL_W;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const wantsImage = modality !== 'text';
      const wantsText = modality !== 'image';
      // Gray background cloud (everything).
      domains.forEach(d => {
        drawLayer(ctx, byDomainModality.get(`${d}:image`) || [], 'image', GRAY, 0.35, scale);
        drawLayer(ctx, byDomainModality.get(`${d}:text`) || [], 'text', GRAY, 0.35, scale);
      });
      // Router prototypes.
      if (showRouter) {
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = ROUTER_EDGE;
        ctx.lineWidth = 1 * scale;
        router.forEach(p => drawTriangle(ctx, sx(p.x) * scale, sy(p.y) * scale, 4.2 * scale));
      }
      // Highlighted datasets on top.
      domains.forEach(d => {
        if (!active.has(d)) return;
        const color = DOMAIN_STYLE[d].color;
        if (wantsImage) drawLayer(ctx, byDomainModality.get(`${d}:image`) || [], 'image', color, 0.7, scale);
        if (wantsText) drawLayer(ctx, byDomainModality.get(`${d}:text`) || [], 'text', color, 0.75, scale);
      });
      ctx.globalAlpha = 1;
    }
    function update() {
      chips.forEach((chip, d) => {
        const on = active.has(d);
        chip.classList.toggle('is-active', on);
        chip.setAttribute('aria-pressed', String(on));
      });
      segButtons.forEach(({ key, button }) => button.classList.toggle('is-active', key === modality));
      routerChip.classList.toggle('is-active', showRouter);
      routerChip.setAttribute('aria-pressed', String(showRouter));
      const names = domains.filter(d => active.has(d)).map(d => DOMAIN_STYLE[d].label);
      const what = modality === 'both' ? 'image patches + text tokens' : modality === 'image' ? 'image patches' : 'text tokens';
      caption.textContent = names.length ? `${names.join(', ')} · ${what}` : 'Click a dataset to color its tokens';
      draw();
    }

    figure.insertBefore(wrap, figure.firstChild);
    if (fallbackImg) fallbackImg.classList.add('iv-hidden');
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(canvasWrap);
    else addEventListener('resize', resize);
    resize();
    update();
  }

  // Data is normally preloaded by a <script src="static/data/tsne_embedding_L18.js"> tag (works from file://);
  // fetch() is only a fallback for hosted builds where that tag is absent.
  const preloaded = window.IV_DATA && window.IV_DATA['tsne_embedding_L18'];
  if (preloaded) {
    build(preloaded);
  } else {
    fetch(DATA_URL)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(build)
      .catch(error => {
        console.warn('[tsne-domains] falling back to static figure (run interactive_visuals/run_export_tsne_embedding.sh on HPC to generate the data):', error);
      });
  }
})();
