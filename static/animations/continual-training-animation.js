(() => {
  const figure = document.getElementById('adaptation-figure');
  if (!figure) return;

  const svg = figure.querySelector('.adaptation-chart');
  const replayButton = figure.querySelector('.adaptation-replay');
  const clock = figure.querySelector('.adaptation-clock');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ns = 'http://www.w3.org/2000/svg';
  const playbackMs = 24000;
  const panelWidth = 280;
  const panelHeight = 170;
  const topY = 68;
  const bottomY = 326;
  const bottomHourLimit = 60;
  const tasks = [
    { id: 'math', name: 'Math', x: 66, min: 48, max: 68, ticks: [50, 55, 60, 65], tint: '#f4f8ed' },
    { id: 'medical', name: 'Medical', x: 390, min: 46, max: 56, ticks: [46, 48, 50, 52, 54, 56], tint: '#eef6fa' },
    { id: 'geo', name: 'Remote sensing', x: 714, min: 40, max: 54, ticks: [42, 45, 48, 51, 54], tint: '#f8f3fa' }
  ];
  const methods = ['ExpertLens', 'FFT', 'LoRA (r=32)'];
  const stageTints = ['#f4f8ed', '#eef6fa', '#f8f3fa'];
  const graphics = [];
  let methodTimelines = new Map();
  let maxHours = 0;
  let frameId = null;
  let startStamp = null;
  let readyToReplay = true;
  let clipIndex = 0;

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

  function yFor(value, task, panelY) {
    return panelY + panelHeight - (value - task.min) / (task.max - task.min) * panelHeight;
  }

  function xFor(value, task, xMax) {
    return task.x + value / xMax * panelWidth;
  }

  function pathFor(points, task, panelY, xKey, yKey, xMax) {
    return points.map((point, index) =>
      `${index ? 'L' : 'M'}${xFor(point[xKey], task, xMax).toFixed(2)} ${yFor(point[yKey], task, panelY).toFixed(2)}`
    ).join(' ');
  }

  function ribbonFor(points, task, panelY, xKey, xMax) {
    const upper = pathFor(points, task, panelY, xKey, 'ci_high', xMax);
    const lower = points.slice().reverse().map(point =>
      `L${xFor(point[xKey], task, xMax).toFixed(2)} ${yFor(point.ci_low, task, panelY).toFixed(2)}`
    ).join(' ');
    return `${upper} ${lower} Z`;
  }

  function drawPanel(task, panelY, isTop, stageLength) {
    const group = element('g');
    if (isTop) {
      stageTints.forEach((tint, index) => {
        element('rect', {
          x: task.x + index * panelWidth / 3, y: panelY,
          width: panelWidth / 3, height: panelHeight, fill: tint
        }, group);
      });
      text(`${task.name} Evals`, task.x + panelWidth / 2, 24,
        'adaptation-panel-title', 'middle');
      ['math', 'medical', 'remote sensing'].forEach((stage, index) => {
        text(stage, task.x + (index + .5) * panelWidth / 3, 46,
          'adaptation-stage-label', 'middle');
      });
    } else {
      element('rect', {
        x: task.x, y: panelY, width: panelWidth,
        height: panelHeight, fill: task.tint
      }, group);
      text(`${task.name} stage`, task.x + panelWidth / 2, 311,
        'adaptation-panel-title', 'middle');
    }

    task.ticks.forEach(value => {
      const y = yFor(value, task, panelY);
      element('line', { x1: task.x, x2: task.x + panelWidth, y1: y, y2: y,
        class: 'adaptation-grid' }, group);
      text(String(value), task.x - 8, y + 3, 'adaptation-tick', 'end', group);
    });
    const xMax = isTop ? stageLength * 3 : bottomHourLimit;
    const xTicks = isTop ? [0, stageLength, stageLength * 2, stageLength * 3] : [0, 20, 40, 60];
    xTicks.forEach(value => {
      const x = xFor(value, task, xMax);
      if (value !== 0 && value !== xMax) {
        element('line', {
          x1: x, x2: x, y1: panelY, y2: panelY + panelHeight,
          class: isTop ? 'adaptation-stage-line' : 'adaptation-grid'
        }, group);
      }
      text(String(value), x, panelY + panelHeight + 17, 'adaptation-tick', 'middle', group);
    });
    element('path', {
      d: `M${task.x} ${panelY} V${panelY + panelHeight} H${task.x + panelWidth}`,
      fill: 'none', stroke: '#aeb8bc', 'stroke-width': 1
    }, group);
  }

  function drawStageArrows(defs) {
    const arrows = [
      { id: 'math', color: '#819d65', path: 'M112 253 C112 266 181 264 206 289' },
      { id: 'medical', color: '#78a9bd', path: 'M526 243 C525 259 531 274 530 289' },
      { id: 'remote', color: '#a68daf', path: 'M947 253 C947 266 879 264 854 289' }
    ];
    arrows.forEach(arrow => {
      const marker = element('marker', {
        id: `adaptation-arrow-${arrow.id}`, viewBox: '0 0 7 7',
        markerWidth: 7, markerHeight: 7, refX: 6, refY: 3.5, orient: 'auto'
      }, defs);
      element('path', { d: 'M0 0 L7 3.5 L0 7 Z', fill: arrow.color }, marker);
      element('path', {
        d: arrow.path, stroke: arrow.color, class: 'adaptation-stage-arrow',
        'marker-end': `url(#adaptation-arrow-${arrow.id})`
      });
    });
  }

  function drawSeries(row, task, panelY, isTop, stageLength, defs, ribbonLayer, lineLayer, dotLayer) {
    const points = isTop ? row.steps : row.stage_hours;
    const xKey = isTop ? 'step' : 'hours';
    const xMax = isTop ? stageLength * 3 : bottomHourLimit;
    const clipId = `adaptation-clip-${clipIndex++}`;
    const clipPath = element('clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' }, defs);
    const clipRect = element('rect', {
      x: task.x, y: panelY, width: 0, height: panelHeight
    }, clipPath);
    const clippedRibbon = element('g', { 'clip-path': `url(#${clipId})` }, ribbonLayer);
    const clippedLine = element('g', { 'clip-path': `url(#${clipId})` }, lineLayer);
    element('path', {
      d: ribbonFor(points, task, panelY, xKey, xMax),
      fill: row.color, opacity: .085
    }, clippedRibbon);
    element('path', {
      d: pathFor(points, task, panelY, xKey, 'mean', xMax),
      stroke: row.color, class: 'adaptation-mean'
    }, clippedLine);
    const dot = element('circle', {
      cx: task.x, cy: yFor(points[0].mean, task, panelY), r: 3,
      stroke: row.color, class: 'adaptation-endpoint', opacity: 0
    }, dotLayer);
    graphics.push({ row, task, panelY, isTop, points, xKey, xMax, clipRect, dot });
  }

  function build(data) {
    svg.replaceChildren();
    graphics.length = 0;
    clipIndex = 0;
    const stageLength = data.stage_length_steps;
    const rowByKey = new Map(data.series.map(row => [`${row.task}:${row.method}`, row]));
    methodTimelines = new Map(methods.map(method => {
      const durations = tasks.map(task =>
        stageLength * rowByKey.get(`${task.id}:${method}`).seconds_per_step / 3600);
      return [method, {
        durations,
        starts: [0, durations[0], durations[0] + durations[1]],
        total: durations.reduce((sum, value) => sum + value, 0)
      }];
    }));
    maxHours = Math.max(...[...methodTimelines.values()].map(timeline => timeline.total));

    const defs = element('defs');
    tasks.forEach(task => {
      drawPanel(task, topY, true, stageLength);
      drawPanel(task, bottomY, false, stageLength);
    });
    text('Training', 31, 39, 'adaptation-stage-label', 'middle');
    text('stage', 31, 52, 'adaptation-stage-label', 'middle');
    drawStageArrows(defs);
    element('text', {
      x: 19, y: topY + panelHeight / 2, class: 'adaptation-axis-label',
      'text-anchor': 'middle', transform: `rotate(-90 19 ${topY + panelHeight / 2})`
    }, svg, 'Accuracy (%)');
    element('text', {
      x: 19, y: bottomY + panelHeight / 2, class: 'adaptation-axis-label',
      'text-anchor': 'middle', transform: `rotate(-90 19 ${bottomY + panelHeight / 2})`
    }, svg, 'Accuracy (%)');
    text('Training step', 10, 281, 'adaptation-axis-label');
    text('Wall clock (hours)', 10, 541, 'adaptation-axis-label');

    const ribbonLayer = element('g');
    const lineLayer = element('g');
    const dotLayer = element('g');
    tasks.forEach(task => {
      methods.forEach(method => {
        const row = rowByKey.get(`${task.id}:${method}`);
        drawSeries(row, task, topY, true, stageLength, defs, ribbonLayer, lineLayer, dotLayer);
        drawSeries(row, task, bottomY, false, stageLength, defs, ribbonLayer, lineLayer, dotLayer);
      });
    });
    update(0);
  }

  function meanAt(points, xKey, xValue) {
    if (xValue <= points[0][xKey]) return points[0].mean;
    for (let index = 1; index < points.length; index++) {
      if (xValue <= points[index][xKey]) {
        const before = points[index - 1];
        const after = points[index];
        const fraction = (xValue - before[xKey]) / (after[xKey] - before[xKey]);
        return before.mean + fraction * (after.mean - before.mean);
      }
    }
    return points[points.length - 1].mean;
  }

  function update(elapsedHours) {
    clock.textContent = `Elapsed wall clock: ${elapsedHours.toFixed(1)} h`;
    graphics.forEach(item => {
      const timeline = methodTimelines.get(item.row.method);
      const stageIndex = tasks.indexOf(item.task);
      const stageStart = timeline.starts[stageIndex];
      const stageDuration = timeline.durations[stageIndex];
      let xValue;
      let visible;
      if (item.isTop) {
        let step = 0;
        for (let index = 0; index < tasks.length; index++) {
          const localHours = Math.max(0, Math.min(timeline.durations[index],
            elapsedHours - timeline.starts[index]));
          step += localHours / timeline.durations[index] * (item.xMax / tasks.length);
        }
        xValue = step;
        visible = true;
      } else {
        xValue = Math.max(0, Math.min(stageDuration, elapsedHours - stageStart));
        visible = elapsedHours >= stageStart;
      }
      const x = xFor(xValue, item.task, item.xMax);
      item.clipRect.setAttribute('width', Math.max(0, x - item.task.x));
      item.dot.setAttribute('cx', x);
      item.dot.setAttribute('cy', yFor(meanAt(item.points, item.xKey, xValue),
        item.task, item.panelY));
      item.dot.setAttribute('opacity', visible ? 1 : 0);
    });
  }

  function frame(timestamp) {
    if (startStamp === null) startStamp = timestamp;
    const elapsed = Math.min(playbackMs, timestamp - startStamp);
    update(elapsed / playbackMs * maxHours);
    frameId = elapsed < playbackMs ? requestAnimationFrame(frame) : null;
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

  const preloaded = window.IV_DATA && window.IV_DATA.continual_training_animation_data;
  const dataSource = preloaded ? Promise.resolve(preloaded) :
    fetch('static/data/continual_training_animation_data.json').then(response => {
      if (!response.ok) throw new Error('Could not load training data');
      return response.json();
    });
  dataSource
    .then(data => {
      build(data);
      replayButton.disabled = false;
      if (reducedMotion) {
        update(maxHours);
      } else {
        addEventListener('scroll', maybeStart, { passive: true });
        addEventListener('resize', maybeStart);
        maybeStart();
      }
    })
    .catch(() => {
      svg.replaceChildren();
      text('Training curves could not be loaded.', 510, 275,
        'adaptation-axis-label', 'middle');
    });

  replayButton.addEventListener('click', () => start(true));
})();
