// Animated version of panel (B) of expertlens_highlight.png: for three ExpertLens-labelled
// experts, the six images whose patches most often routed to that expert appear one by one.
// Data: static/data/expertlens_top6.json (see MoE_interp_clean/interactive_visuals/crop_expertlens_top6.py)
(() => {
  const figure = document.getElementById('expertlens-top6-figure');
  if (!figure) return;
  const fallbackImg = figure.querySelector('img');
  const IMG_DIR = 'static/figures/expertlens_top6/';
  const STEP_MS = 380;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    const wrap = html('div', 'iv-figure iv-top6');
    const grid = html('div', 'iv-top6-grid', wrap);
    grid.style.setProperty('--iv-top6-cols', String(data.experts.length));

    // Row 1: expert index pills
    html('div', 'iv-top6-rowlabel', grid, 'Expert index');
    data.experts.forEach(e => {
      const cell = html('div', 'iv-top6-cell', grid);
      const pill = html('div', 'iv-top6-pill', cell);
      pill.style.background = e.shade;
      html('span', 'iv-top6-pill-id', pill, `E${e.expert}`);
      html('span', 'iv-top6-pill-name', pill, `layer ${data.layer} · ${e.name}`);
    });
    // Row 2: decoded logits (selectable text)
    html('div', 'iv-top6-rowlabel', grid, 'Decoded logits');
    data.experts.forEach(e => {
      const cell = html('div', 'iv-top6-cell iv-top6-tokens', grid);
      e.tokens.forEach((tok, i) => {
        if (i) html('span', 'iv-top6-dot', cell, ' · ');
        html('span', '', cell, tok);
      });
    });
    // Row 3: image grids
    html('div', 'iv-top6-rowlabel', grid, 'Top-6 activated images');
    const tiles = [];
    data.experts.forEach((e, ei) => {
      const cell = html('div', 'iv-top6-cell', grid);
      const imgs = html('div', 'iv-top6-images', cell);
      e.images.forEach((img, slot) => {
        const tile = html('figure', 'iv-top6-tile', imgs);
        const track = html('div', 'iv-top6-track', tile);
        const fill = html('div', 'iv-top6-fill', track);
        fill.style.background = e.color;
        fill.style.setProperty('--iv-fill', `${(100 * img.fraction).toFixed(1)}%`);
        const pic = document.createElement('img');
        pic.src = IMG_DIR + img.file;
        pic.alt = `Image ${slot + 1} of 6 most activating E${e.expert}; ${(100 * img.fraction).toFixed(0)}% of its patches routed to the expert.`;
        pic.loading = 'lazy';
        pic.decoding = 'async';
        tile.appendChild(pic);
        tile.title = `${(100 * img.fraction).toFixed(1)}% of this image's patches routed to E${e.expert}`;
        tiles.push({ tile, order: slot * data.experts.length + ei });
      });
    });
    tiles.sort((a, b) => a.order - b.order);

    // Legend + controls
    const legend = html('div', 'iv-top6-legend', wrap);
    const swatch = html('span', 'iv-top6-legend-swatch', legend);
    html('i', '', swatch).style.background = data.experts[0].color;
    html('i', 'is-track', swatch);
    html('span', '', legend,
      'The bar above each image shows the share of that image’s patches for which this expert fired (colored) versus the rest (gray). ' +
      'The same number of images from each dataset across all three domains (medical, math, remote sensing) was passed through the model; ' +
      'the six images with the most patches routed to each expert are shown.');
    const controls = html('div', 'iv-controls', wrap);
    html('span', 'iv-spacer', controls);
    const replay = html('button', 'iv-btn', controls, 'Replay');
    replay.type = 'button';
    replay.setAttribute('aria-label', 'Replay image reveal animation');

    let timers = [];
    function stop() { timers.forEach(clearTimeout); timers = []; }
    function reveal(instant) {
      stop();
      tiles.forEach(t => t.tile.classList.remove('is-shown'));
      if (instant || reducedMotion) {
        // Force a reflow so the class toggle is not batched into a no-op.
        void wrap.offsetWidth;
        tiles.forEach(t => t.tile.classList.add('is-shown'));
        replay.disabled = false;
        return;
      }
      replay.disabled = true;
      void wrap.offsetWidth;
      tiles.forEach((t, i) => {
        timers.push(setTimeout(() => t.tile.classList.add('is-shown'), 150 + i * STEP_MS));
      });
      timers.push(setTimeout(() => { replay.disabled = false; }, 150 + tiles.length * STEP_MS + 500));
    }
    replay.addEventListener('click', () => reveal(false));

    figure.insertBefore(wrap, figure.firstChild);
    if (fallbackImg) fallbackImg.classList.add('iv-hidden');

    let started = false;
    if (typeof IntersectionObserver !== 'undefined' && !reducedMotion) {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting) && !started) {
          started = true;
          observer.disconnect();
          reveal(false);
        }
      }, { threshold: 0.35 });
      observer.observe(wrap);
    } else {
      reveal(true);
    }
  }

  const preloaded = window.IV_DATA && window.IV_DATA['expertlens_top6'];
  if (preloaded) {
    build(preloaded);
  } else {
    fetch('static/data/expertlens_top6.json')
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(build)
      .catch(error => {
        console.warn('[expertlens-top6] falling back to static figure:', error);
      });
  }
})();
