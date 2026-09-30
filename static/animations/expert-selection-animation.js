(() => {
  const figure = document.getElementById('expert-selection-figure');
  if (!figure) return;

  const svg = figure.querySelector('.selection-chart');
  const replayButton = figure.querySelector('.selection-replay');
  const legendItems = [...figure.querySelectorAll('.selection-legend span')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ns = 'http://www.w3.org/2000/svg';
  const plotTop = 42;
  const plotHeight = 176;
  const plotWidth = 190;
  const phaseMs = 1800;
  const pauseMs = 125;
  const methods = ['Random (disjoint)', 'Random (full)', 'ExpertLens'];
  const totalTime = methods.length * phaseMs + (methods.length - 1) * pauseMs;
  const tasks = [
    { id: 'math', name: 'Math', x: 48, min: 49, max: 68, ticks: [50, 55, 60, 65] },
    { id: 'medical', name: 'Medical', x: 272, min: 47, max: 55.5, ticks: [48, 50, 52, 54] },
    { id: 'remote_sensing', name: 'Remote sensing', x: 496, min: 40, max: 54, ticks: [42, 46, 50, 54] }
  ];
  const stageColors = ['#f4f8ed', '#eef6fa', '#f8f3fa'];
  const stageNames = ['math', 'medical', 'remote sensing'];
  const graphics = [];
  let frameId = null;
  let startStamp = null;
  let readyToReplay = true;

  function element(tag, attributes = {}, parent = svg, content) {
    const node = document.createElementNS(ns, tag);
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
    if (content !== undefined) node.textContent = content;
    parent.appendChild(node);
    return node;
  }

  function text(value, x, y, className, anchor = 'start', parent = svg) {
    return element('text', { x, y, class: className, 'text-anchor': anchor }, parent, value);
  }

  function xFor(step, task, maxStep) {
    return task.x + step / maxStep * plotWidth;
  }

  function yFor(value, task) {
    return plotTop + plotHeight - (value - task.min) / (task.max - task.min) * plotHeight;
  }

  function linePath(points, task, maxStep, key) {
    return points.map((point, index) =>
      `${index ? 'L' : 'M'}${xFor(point.step, task, maxStep).toFixed(2)} ${yFor(point[key], task).toFixed(2)}`
    ).join(' ');
  }

  function ribbonPath(points, task, maxStep) {
    const upper = linePath(points, task, maxStep, 'ci_high');
    const lower = points.slice().reverse().map(point =>
      `L${xFor(point.step, task, maxStep).toFixed(2)} ${yFor(point.ci_low, task).toFixed(2)}`
    ).join(' ');
    return `${upper} ${lower} Z`;
  }

  function drawPanel(task, boundaries, maxStep) {
    const group = element('g');
    let prior = 0;
    boundaries.forEach((end, index) => {
      element('rect', {
        x: xFor(prior, task, maxStep), y: plotTop,
        width: (end - prior) / maxStep * plotWidth,
        height: plotHeight, fill: stageColors[index]
      }, group);
      text(stageNames[index], xFor((prior + end) / 2, task, maxStep), 30,
        'selection-stage-label', 'middle');
      prior = end;
    });
    task.ticks.forEach(value => {
      const y = yFor(value, task);
      element('line', { x1: task.x, x2: task.x + plotWidth,
        y1: y, y2: y, class: 'selection-grid' }, group);
      text(String(value), task.x - 5, y + 3, 'selection-tick', 'end', group);
    });
    [0, ...boundaries].forEach(step => {
      const x = xFor(step, task, maxStep);
      if (step !== 0 && step !== maxStep) {
        element('line', { x1: x, x2: x, y1: plotTop,
          y2: plotTop + plotHeight, class: 'selection-boundary' }, group);
      }
      text(String(step), x, plotTop + plotHeight + 15,
        'selection-tick', 'middle', group);
    });
    element('path', {
      d: `M${task.x} ${plotTop} V${plotTop + plotHeight} H${task.x + plotWidth}`,
      fill: 'none', stroke: '#aeb8bc', 'stroke-width': 1
    }, group);
    text(task.name, task.x + plotWidth - 7, plotTop + plotHeight - 8,
      'selection-panel-title', 'end', group);
  }

  function meanAt(points, step) {
    if (step <= points[0].step) return points[0].mean;
    for (let index = 1; index < points.length; index++) {
      if (step <= points[index].step) {
        const before = points[index - 1];
        const after = points[index];
        const fraction = (step - before.step) / (after.step - before.step);
        return before.mean + fraction * (after.mean - before.mean);
      }
    }
    return points[points.length - 1].mean;
  }

  function build(data) {
    svg.replaceChildren();
    graphics.length = 0;
    const boundaries = data.stage_boundaries;
    const maxStep = boundaries[boundaries.length - 1];
    const rows = new Map(data.series.map(row => [`${row.task}:${row.method}`, row]));
    const defs = element('defs');
    tasks.forEach(task => drawPanel(task, boundaries, maxStep));
    element('text', {
      x: 14, y: plotTop + plotHeight / 2, class: 'selection-axis-label',
      'text-anchor': 'middle',
      transform: `rotate(-90 14 ${plotTop + plotHeight / 2})`
    }, svg, 'Accuracy (%)');
    text('Training step', 350, 260, 'selection-axis-label', 'middle');

    const ribbonLayer = element('g');
    const lineLayer = element('g');
    const dotLayer = element('g');
    methods.forEach((method, methodIndex) => {
      tasks.forEach(task => {
        const row = rows.get(`${task.id}:${method}`);
        const clipId = `selection-clip-${methodIndex}-${task.id}`;
        const clipPath = element('clipPath', {
          id: clipId, clipPathUnits: 'userSpaceOnUse'
        }, defs);
        const clipRect = element('rect', {
          x: task.x, y: plotTop, width: 0, height: plotHeight
        }, clipPath);
        const clipUrl = `url(#${clipId})`;
        const ribbon = element('g', { 'clip-path': clipUrl }, ribbonLayer);
        element('path', {
          d: ribbonPath(row.points, task, maxStep),
          fill: row.color, opacity: .11
        }, ribbon);
        const curve = element('g', { 'clip-path': clipUrl }, lineLayer);
        const path = element('path', {
          d: linePath(row.points, task, maxStep, 'mean'),
          stroke: row.color, class: 'selection-curve'
        }, curve);
        element('title', {}, path, `${task.name} · ${method}`);
        const endpoint = element('circle', {
          cx: task.x, cy: yFor(row.points[0].mean, task), r: 2.8,
          stroke: row.color, opacity: 0, class: 'selection-endpoint'
        }, dotLayer);
        graphics.push({ task, row, methodIndex, maxStep, clipRect, endpoint });
      });
    });
    update(0);
  }

  function update(elapsed) {
    legendItems.forEach((item, index) => {
      const start = index * (phaseMs + pauseMs);
      item.classList.toggle('is-drawing', elapsed >= start && elapsed < start + phaseMs);
    });
    graphics.forEach(item => {
      const start = item.methodIndex * (phaseMs + pauseMs);
      const fraction = Math.max(0, Math.min(1, (elapsed - start) / phaseMs));
      const step = fraction * item.maxStep;
      item.clipRect.setAttribute('width', fraction * plotWidth);
      item.endpoint.setAttribute('cx', xFor(step, item.task, item.maxStep));
      item.endpoint.setAttribute('cy', yFor(meanAt(item.row.points, step), item.task));
      item.endpoint.setAttribute('opacity', elapsed >= start ? 1 : 0);
    });
  }

  function frame(timestamp) {
    if (startStamp === null) startStamp = timestamp;
    const elapsed = Math.min(totalTime, timestamp - startStamp);
    update(elapsed);
    frameId = elapsed < totalTime ? requestAnimationFrame(frame) : null;
  }

  function start(force = false) {
    if (reducedMotion && !force) return;
    if (frameId !== null) cancelAnimationFrame(frameId);
    readyToReplay = false;
    startStamp = null;
    update(0);
    frameId = requestAnimationFrame(frame);
  }

  function maybeStart() {
    if (reducedMotion) return;
    const bounds = figure.getBoundingClientRect();
    const midpoint = innerHeight / 2;
    if (bounds.bottom <= 0 || bounds.top >= innerHeight) {
      readyToReplay = true;
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
    } else if (readyToReplay && bounds.top <= midpoint && bounds.bottom >= midpoint) {
      start();
    }
  }

  const preloaded = window.IV_DATA && window.IV_DATA.expertlens_random_animation_data;
  const dataSource = preloaded ? Promise.resolve(preloaded) :
    fetch('static/data/expertlens_random_animation_data.json').then(response => {
      if (!response.ok) throw new Error('Could not load expert-selection data');
      return response.json();
    });
  dataSource
    .then(data => {
      build(data);
      replayButton.disabled = false;
      if (reducedMotion) {
        update(totalTime);
      } else {
        addEventListener('scroll', maybeStart, { passive: true });
        addEventListener('resize', maybeStart);
        maybeStart();
      }
    })
    .catch(() => {
      svg.replaceChildren();
      text('Expert-selection curves could not be loaded.', 350, 140,
        'selection-axis-label', 'middle');
    });

  replayButton.addEventListener('click', () => start(true));
})();
