(() => {
  const figure = document.getElementById('expert-activation-figure');
  if (!figure) return;

  const svg = figure.querySelector('.activation-chart');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ns = 'http://www.w3.org/2000/svg';
  const datasetOrder = [
    'breast_histopathology', 'medmnist_path', 'mathvista',
    'cosyn_400k', 'rsvqa_lr', 'rsvqa_hr'
  ];
  const legendNames = ['breast_histopathology', 'medmnist', 'mathvista', 'cosyn_400k', 'RSVQA_lr', 'RSVQA_hr'];
  const groups = [
    { id: 'medicine', name: 'Medical experts', color: '#eaf4fa' },
    { id: 'math', name: 'Math experts', color: '#fdf0f5' },
    { id: 'remote_sensing', name: 'Remote-sensing experts', color: '#fff3e8' }
  ];
  const panels = [
    { id: 'text', title: 'Text tokens', top: 118, bottom: 248 },
    { id: 'image', title: 'Image patches', top: 315, bottom: 445 }
  ];
  const plotLeft = 74;
  const plotRight = 654;
  const plotHeight = 130;
  const maxRatio = 0.2;
  const totalTime = 7600;
  const bars = [];
  const groupLabels = [];
  let started = false;
  let startTime = null;

  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = value => { const x = clamp(value); return x * x * (3 - 2 * x); };

  function element(tag, attributes = {}, parent = svg, content) {
    const child = document.createElementNS(ns, tag);
    Object.entries(attributes).forEach(([name, value]) => child.setAttribute(name, value));
    if (content !== undefined) child.textContent = content;
    parent.appendChild(child);
    return child;
  }

  function text(value, x, y, className, anchor = 'start', parent = svg) {
    return element('text', { x, y, class: className, 'text-anchor': anchor }, parent, value);
  }

  function build(data) {
    svg.replaceChildren();
    const rowByKey = new Map(data.rows.map(row =>
      [`${row.modality}:${row.expert_group}:${row.dataset}`, row]));

    ['Medical Data', 'Math Data', 'Remote Sensing Data'].forEach((name, index) => {
      text(name, 164 + index * 200, 20, 'activation-category-label', 'middle');
    });
    const legend = [0, 2, 4, 1, 3, 5];
    legend.forEach((datasetIndex, position) => {
      const column = position % 3;
      const row = Math.floor(position / 3);
      const x = 83 + column * 205;
      const y = 40 + row * 20;
      const datum = data.rows.find(item => item.dataset === datasetOrder[datasetIndex]);
      element('rect', { x, y: y - 10, width: 11, height: 11, rx: 1.5, fill: datum.color });
      text(legendNames[datasetIndex], x + 17, y, 'activation-legend');
    });
    text('Text tokens', 364, 90, 'activation-panel-title', 'middle');
    text('Dataset-hit ratio per expert', plotLeft, 108, 'activation-axis-title');
    text('Image patches', 364, 292, 'activation-panel-title', 'middle');

    panels.forEach(panel => {
      groups.forEach((group, groupIndex) => {
        element('rect', {
          x: plotLeft + groupIndex * 200, y: panel.top, width: 180,
          height: plotHeight, fill: group.color
        });
      });
      [0, .05, .1, .15, .2].forEach(value => {
        const y = panel.bottom - value / maxRatio * plotHeight;
        element('line', { x1: plotLeft, x2: plotRight, y1: y, y2: y, class: 'activation-grid' });
        text(value === 0 ? '0' : value.toFixed(2), 64, y + 4, 'activation-tick', 'end');
      });
    });

    groups.forEach((group, groupIndex) => {
      const center = 164 + groupIndex * 200;
      groupLabels.push(text(group.name, center, 471, 'activation-group-label', 'middle'));
    });

    const haloLayer = element('g');
    const barLayer = element('g');
    const errorLayer = element('g');
    const starLayer = element('g');

    panels.forEach(panel => {
      groups.forEach((group, groupIndex) => {
        const center = 164 + groupIndex * 200;
        const firstX = center - 63;
        datasetOrder.forEach((dataset, datasetIndex) => {
          const row = rowByKey.get(`${panel.id}:${group.id}:${dataset}`);
          if (!row) return;
          const x = firstX + datasetIndex * 22;
          const targetHeight = row.plot_mean_x10 / maxRatio * plotHeight;
          const semHeight = row.plot_sem_x10 / maxRatio * plotHeight;
          const halo = row.top_two ? element('rect', {
            x: x - 3, y: panel.bottom, width: 22, height: 0, rx: 2,
            class: 'activation-halo'
          }, haloLayer) : null;
          const bar = element('rect', {
            x, y: panel.bottom, width: 16, height: 0, rx: 1,
            fill: row.color, class: 'activation-bar'
          }, barLayer);
          element('title', {}, bar,
            `${panel.title} · ${group.name} · ${dataset}\nDisplayed ratio ${row.plot_mean_x10.toFixed(3)} ± ${row.plot_sem_x10.toFixed(3)}`);
          const error = element('g', { class: 'activation-error', opacity: 0 }, errorLayer);
          const errorX = x + 8;
          const topY = panel.bottom - targetHeight;
          element('line', { x1: errorX, x2: errorX, y1: topY - semHeight, y2: topY + semHeight }, error);
          element('line', { x1: errorX - 3, x2: errorX + 3, y1: topY - semHeight, y2: topY - semHeight }, error);
          element('line', { x1: errorX - 3, x2: errorX + 3, y1: topY + semHeight, y2: topY + semHeight }, error);
          const star = row.top_two ? text('*', errorX, topY - semHeight - 6, 'activation-star', 'middle', starLayer) : null;
          if (star) star.setAttribute('opacity', 0);
          bars.push({ row, groupIndex, x, bottom: panel.bottom, targetHeight, semHeight, bar, halo, error, star });
        });
      });
    });
    update(0);
  }

  function update(elapsed) {
    groupLabels.forEach((label, index) => {
      label.classList.toggle('is-emphasized', elapsed >= 4500 + index * 570);
    });
    bars.forEach(item => {
      const { row, groupIndex, x, bottom, targetHeight, bar, halo, error, star } = item;
      const start = (x - plotLeft) / (plotRight - plotLeft) * 4050;
      const growth = ease((elapsed - start) / 820);
      const emphasis = ease((elapsed - 4500 - groupIndex * 570) / 650);
      const pulse = row.top_two ? Math.sin(Math.PI * emphasis) * 4 : 0;
      const height = targetHeight * growth + pulse;
      bar.setAttribute('y', bottom - height);
      bar.setAttribute('height', height);
      bar.setAttribute('opacity', row.top_two ? 1 : 1 - emphasis * .42);
      error.setAttribute('opacity', growth > .85 ? (growth - .85) / .15 : 0);
      if (halo) {
        halo.setAttribute('y', bottom - height - 3);
        halo.setAttribute('height', height + 6);
        halo.setAttribute('opacity', emphasis * .8);
      }
      if (star) {
        const reveal = ease((elapsed - 5000 - groupIndex * 570) / 320);
        star.setAttribute('opacity', reveal);
        star.setAttribute('transform', `translate(0 ${6 * (1 - reveal)})`);
      }
    });
  }

  function frame(timestamp) {
    if (startTime === null) startTime = timestamp;
    const elapsed = Math.min(totalTime, timestamp - startTime);
    update(elapsed);
    if (elapsed < totalTime) requestAnimationFrame(frame);
  }

  function start() {
    if (reducedMotion) return;
    started = true;
    removeEventListener('scroll', maybeStart);
    removeEventListener('resize', maybeStart);
    startTime = null;
    update(0);
    requestAnimationFrame(frame);
  }

  function maybeStart() {
    if (started || reducedMotion) return;
    const bounds = figure.getBoundingClientRect();
    const midpoint = innerHeight / 2;
    if (bounds.top <= midpoint && bounds.bottom >= midpoint) start();
  }

  fetch('static/data/figure_a_animation_data.json')
    .then(response => {
      if (!response.ok) throw new Error('Could not load chart data');
      return response.json();
    })
    .then(data => {
      build(data);
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
      text('Chart data could not be loaded.', 350, 255, 'activation-error-message', 'middle');
    });
})();
