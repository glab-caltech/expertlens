(() => {
  const film = document.getElementById('expertlens-film');
  if (!film) return;
  const canvas = document.getElementById('lens-canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const button = film.querySelector('.lens-play');
  const seek = film.querySelector('.lens-seek');
  const clock = film.querySelector('.lens-clock');
  const caption = film.querySelector('.lens-caption');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const sceneDuration = 15;
  const duration = 18;
  const width = 700;
  const height = 380;
  const color = {
    ink: '#171d21', muted: '#64717a', faint: '#9ba8af', line: '#e2e8eb',
    accent: '#355d73', pale: '#e7eef2', gray: '#cbd4d9', white: '#fff'
  };
  const tokens = ['algebra', 'equation', 'Euler', 'equals', 'garden', 'window', 'river', 'cloud', 'book', 'stone'];
  const scoreColors = ['#173e59', '#1e4d6a', '#28617f', '#36718e', '#467f99',
    '#9abbd0', '#acc9d9', '#b9d2df', '#c7dbe6', '#d4e3ea'];
  const captions = [
    'ExpertLens classifies each MLP expert directly from its router weights.',
    'Each expert’s router weight is multiplied by the model’s LM head, producing logits over the output vocabulary.',
    'An LLM judges whether each of the top M tokens (M = 5 here) is related to the domain.',
    'These classifications reveal domain-relevant experts without domain-specific data.'
  ];
  let time = 0;
  let playing = false;
  let started = false;
  let previousFrame = 0;
  let frameId = 0;

  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = value => { const x = clamp(value); return x * x * (3 - 2 * x); };
  const between = (t, start, end) => ease((t - start) / (end - start));
  const lerp = (start, end, amount) => start + (end - start) * amount;
  const visible = (t, enterStart, enterEnd, exitStart, exitEnd) =>
    between(t, enterStart, enterEnd) * (1 - between(t, exitStart, exitEnd));

  function text(value, x, y, size = 14, tint = color.ink, align = 'left', mono = false, weight = 400) {
    ctx.fillStyle = tint;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.font = `${weight} ${size}px ${mono ? '"IBM Plex Mono", monospace' : '"DM Sans", sans-serif'}`;
    ctx.fillText(value, x, y);
  }

  function line(x1, y1, x2, y2, tint = color.line, lineWidth = 1) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = tint;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  function rect(x, y, w, h, fill, stroke = null, radius = 2) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.4; ctx.stroke(); }
  }

  function matrix(x, y, rows, columns, cellWidth, cellHeight, tint, opacity = 1) {
    ctx.save();
    const baseAlpha = ctx.globalAlpha;
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const strength = (Math.sin(row * 2.7 + column * 1.9) + 1) / 2;
        ctx.globalAlpha = baseAlpha * opacity * (.28 + strength * .55);
        rect(x + column * cellWidth + 2, y + row * cellHeight + 2,
          cellWidth - 5, cellHeight - 5, tint);
      }
    }
    ctx.restore();
  }

  function addNode(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fillStyle = color.white;
    ctx.fill();
    ctx.strokeStyle = color.line;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    text('+', x, y + 5, 17, color.muted, 'center', true);
  }

  function drawModel(t) {
    const alpha = 1 - between(t, 2.15, 2.55);
    if (alpha <= 0) return;
    const zoom = between(t, 1.0, 2.15);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.globalAlpha *= 1 - between(t, 1.05, 1.95);
    text('Pretrained MoE', 350, 35, 18, color.ink, 'center', false, 500);
    ctx.translate(0, -6);
    rect(190, 50, 320, 305, color.white, color.line, 4);
    text('Decoder layer  ℓ = 18', 350, 76, 14, color.ink, 'center', true, 500);
    line(350, 81, 350, 88, color.line, 1.4);
    rect(280, 89, 140, 26, color.white, color.line, 3);
    text('RMSNorm', 350, 107, 12, color.muted, 'center', true);
    line(350, 115, 350, 128, color.line, 1.4);
    rect(275, 129, 150, 31, color.white, color.line, 3);
    text('Self-attention', 350, 149, 11, color.muted, 'center', true);
    line(350, 160, 350, 166, color.line, 1.4);
    line(350, 80, 218, 80, color.line, 1.2);
    line(218, 80, 218, 177, color.line, 1.2);
    line(218, 177, 339, 177, color.line, 1.2);
    addNode(350, 177);
    line(350, 188, 350, 193, color.line, 1.4);
    rect(280, 194, 140, 26, color.white, color.line, 3);
    text('RMSNorm', 350, 212, 12, color.muted, 'center', true);
    line(350, 220, 350, 231, color.line, 1.4);
    rect(236, 232, 228, 82, color.white, color.line, 3);
    line(350, 266, 350, 274, color.line, 1.2);
    line(274, 274, 426, 274, color.line, 1.2);
    for (let index = 0; index < 4; index++) {
      const expertX = 263 + index * 47;
      line(expertX + 12, 274, expertX + 12, 282, color.line, 1.2);
      rect(expertX, 282, 24, 17, color.white, color.line, 2);
      line(expertX + 12, 299, expertX + 12, 305, color.line, 1.2);
    }
    line(275, 305, 416, 305, color.line, 1.2);
    line(350, 305, 350, 320, color.line, 1.4);
    line(350, 188, 205, 188, color.line, 1.2);
    line(205, 188, 205, 331, color.line, 1.2);
    line(205, 331, 339, 331, color.line, 1.2);
    addNode(350, 331);
    line(350, 342, 350, 354, color.line, 1.4);
    ctx.restore();

    // The router-weights box itself expands into the matrix shown next.
    const x = lerp(305, 142, zoom);
    const y = lerp(232, 111, zoom);
    const w = lerp(90, 416, zoom);
    const h = lerp(29, 183, zoom);
    rect(x, y, w, h, color.pale, color.accent, 3);
    ctx.save();
    ctx.globalAlpha *= 1 - between(t, 1.35, 1.9);
    text('Router weights', x + w / 2, y + h / 2 + 4, 10, color.accent, 'center', true, 500);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha *= between(t, 1.7, 2.15);
    ctx.translate(x, y);
    ctx.scale(w / 416, h / 183);
    matrix(11, 12, 7, 12, 33, 22, color.gray);
    ctx.restore();
    ctx.restore();
  }

  function drawRouter(t) {
    const alpha = visible(t, 2.15, 2.55, 4.55, 5.25);
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const extract = between(t, 3.3, 4.55);
    ctx.save();
    ctx.globalAlpha *= 1 - extract;
    rect(142, 111, 416, 183, color.white, color.line, 3);
    matrix(153, 123, 7, 12, 33, 22, color.gray);
    text('N expert rows  ×  hidden_dim', 350, 324, 12, color.muted, 'center', true);
    ctx.restore();

    // W_r has one row per expert. Pull row i out, then orient it as a column for U w_i.
    const rowY = 123 + 3 * 22;
    for (let column = 0; column < 12; column++) {
      const x = lerp(155 + column * 33, 274, extract);
      const y = lerp(rowY + 2, 93 + column * 17, extract);
      const cellWidth = lerp(28, 12, extract);
      const cellHeight = lerp(17, 13, extract);
      rect(x, y, cellWidth, cellHeight,
        column % 3 === 0 ? color.accent : '#7294a6');
    }
    if (extract < .95) {
      ctx.save();
      ctx.globalAlpha *= 1 - extract;
      rect(148, rowY - 2, 402, 24, null, color.accent, 2);
      text('expert i', 128, rowY + 16, 12, color.accent, 'right', true);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawDecode(t) {
    const alpha = between(t, 4.55, 5.25);
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;

    text('LM Head (U)', 116, 71, 14, color.accent, 'center', true, 500);
    rect(24, 86, 184, 207, color.white, color.line, 3);
    matrix(32, 93, 10, 12, 14, 19, color.gray);
    text('vocab_len × hidden_dim', 116, 319, 10, color.muted, 'center', true);

    const multiply = between(t, 5.15, 5.75);
    ctx.save();
    ctx.globalAlpha *= multiply;
    text('×', 238, 196, 24, color.faint, 'center', true);
    ctx.restore();
    for (let index = 0; index < 12; index++) {
      rect(274, 93 + index * 17, 12, 13,
        index % 3 === 0 ? color.accent : '#7294a6');
    }
    text('hidden_dim × 1', 280, 319, 10, color.muted, 'center', true);
    ctx.save();
    ctx.globalAlpha *= multiply;
    text('=', 326, 196, 24, color.faint, 'center', true);
    ctx.restore();

    const focus = between(t, 7.8, 8.7);
    tokens.forEach((token, index) => {
      const y = 90 + index * 21;
      const reveal = between(t, 5.55 + index * .13, 6.25 + index * .13);
      if (reveal <= 0) return;
      ctx.save();
      ctx.globalAlpha *= reveal * (index < 5 ? 1 : 1 - focus * .77);
      rect(353, y, 20, 16, scoreColors[index], null, 2);
      text(`“${token}”`, 385, y + 13, 12, color.ink, 'left', false, 500);
      ctx.restore();

      if (index < 5) {
        ctx.save();
        ctx.globalAlpha *= between(t, 8.85 + index * .38, 9.1 + index * .38);
        text(index === 4 ? '✗' : '✓', 503, y + 14, 17, color.accent, 'center');
        ctx.restore();
      }
    });

    ctx.save();
    ctx.globalAlpha *= focus;
    line(520, 88, 528, 88, color.accent, 1.5);
    line(528, 88, 528, 190, color.accent, 1.5);
    line(520, 190, 528, 190, color.accent, 1.5);
    ctx.restore();

    const checks = between(t, 8.65, 9.2);
    ctx.save();
    ctx.globalAlpha *= checks;
    text('Math related?', 503, 73, 11, color.muted, 'center', true);
    ctx.restore();

    const verdict = between(t, 10.75, 11.65);
    if (verdict > 0) {
      ctx.save();
      ctx.globalAlpha *= verdict;
      line(528, 139, 555, 139, color.accent, 1.6);
      line(549, 134, 555, 139, color.accent, 1.6);
      line(549, 144, 555, 139, color.accent, 1.6);
      text('Math expert', 565, 145, 15, color.ink, 'left', false, 500);
      text('✓', 676, 145, 18, color.accent, 'center');
      ctx.restore();
    }
    ctx.restore();
  }

  function draw() {
    const sceneTime = time * sceneDuration / duration;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = color.white;
    ctx.fillRect(0, 0, width, height);
    drawModel(sceneTime);
    drawRouter(sceneTime);
    drawDecode(sceneTime);
  }

  function updateControls() {
    seek.value = Math.round(time * 100);
    seek.style.background = `linear-gradient(to right, ${color.accent} ${time / duration * 100}%, ${color.line} ${time / duration * 100}%)`;
    clock.textContent = `0:${String(Math.floor(time)).padStart(2, '0')} / 0:18`;
    const sceneTime = time * sceneDuration / duration;
    const stage = sceneTime < 3.3 ? 0 : sceneTime < 7.8 ? 1 : sceneTime < 10.75 ? 2 : 3;
    if (caption.textContent !== captions[stage]) caption.textContent = captions[stage];
    button.textContent = playing ? 'Pause' : time >= duration ? 'Replay' : 'Play';
    button.setAttribute('aria-label', `${button.textContent} ExpertLens animation`);
  }

  function render() { draw(); updateControls(); }
  function resize() {
    const cssWidth = canvas.getBoundingClientRect().width;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssWidth * pixelRatio);
    canvas.height = Math.round(cssWidth * height / width * pixelRatio);
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    render();
  }
  function tick(timestamp) {
    if (!playing) return;
    if (previousFrame) time = (time + (timestamp - previousFrame) / 1000) % duration;
    previousFrame = timestamp;
    render();
    frameId = requestAnimationFrame(tick);
  }
  function pause() {
    playing = false;
    previousFrame = 0;
    cancelAnimationFrame(frameId);
    updateControls();
  }
  function play() {
    if (time >= duration) time = 0;
    started = true;
    removeEventListener('scroll', maybeAutoplay);
    removeEventListener('resize', maybeAutoplay);
    playing = true;
    previousFrame = 0;
    updateControls();
    frameId = requestAnimationFrame(tick);
  }

  button.addEventListener('click', () => playing ? pause() : play());
  seek.addEventListener('input', () => {
    const requestedTime = Number(seek.value) / 100;
    pause();
    started = true;
    removeEventListener('scroll', maybeAutoplay);
    removeEventListener('resize', maybeAutoplay);
    time = requestedTime;
    render();
  });
  if (reducedMotion.matches) time = duration;
  resize();
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(film);
  else addEventListener('resize', resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);

  // Begin when the animation reaches the middle of the viewport, where readers see it.
  function maybeAutoplay() {
    if (started || reducedMotion.matches) return;
    const bounds = film.getBoundingClientRect();
    const midpoint = window.innerHeight / 2;
    if (bounds.top <= midpoint && bounds.bottom >= midpoint) play();
  }
  if (!reducedMotion.matches) {
    addEventListener('scroll', maybeAutoplay, { passive: true });
    addEventListener('resize', maybeAutoplay);
    maybeAutoplay();
  }
})();
