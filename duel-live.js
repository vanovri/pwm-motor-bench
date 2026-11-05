function mountDuel() {
  const mode = get('duel-toggle');
  const panel = get('duel-view');
  const run = get('duel-run');
  const reset = get('duel-reset');
  const pit = get('pit-config');
  const kp = get('pit-kp');
  const ki = get('pit-ki');
  const profiles = [...pit.querySelectorAll('[data-pi-profile]')];
  const baselineLine = get('duel-baseline-line');
  const resultPanel = get('duel-result');
  const choices = [...panel.querySelectorAll('[data-duel-load]')];
  const stages = [...panel.querySelectorAll('[data-stage]')];
  const lanes = Object.fromEntries(['fixed', 'hold'].map((name) => {
    const card = panel.querySelector(`[data-lane="${name}"]`);
    return [name, {
      rpm: card.querySelector('[data-lane-rpm]'),
      duty: card.querySelector('[data-lane-duty]'),
      rotor: card.querySelector('[data-duel-rotor]'),
      path: get(`duel-${name}-line`),
      dot: get(`duel-${name}-dot`),
    }];
  }));
  const timeFormat = new Intl.NumberFormat('id-ID', { minimumIntegerDigits: 2, minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const gainFormat = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const names = ['STABIL', 'BEBAN MASUK', 'PEMULIHAN'];
  const curveX = (time) => time / DUEL.duration * 550;
  const curveY = (speed) => 155 * (3000 - speed) / 2500;
  const sameGains = (first, second) => first.kp === second.kp && first.ki === second.ki;
  let load = 65;
  let time = 0;
  let state = 'ready';
  let race;
  let baseline;
  let gains = { ...PI_DEFAULT };
  let paths;
  let frameId = 0;
  let startedAt = 0;
  let lastIndex = -1;

  function showStage(stage) {
    for (const item of stages) item.classList.toggle('current', Number(item.dataset.stage) === stage && state !== 'ready');
    panel.dataset.loaded = stage === 1 && state !== 'ready';
    get('duel-load').textContent = `${duelLoad(time, load)}%`;
    get('duel-phase').textContent = state === 'ready' ? 'SIAP' : state === 'finished' ? 'SELESAI'
      : state === 'paused' ? 'JEDA' : names[stage];
  }

  function render() {
    const index = Math.min(race.samples.length - 1, Math.floor(time / DUEL.step + 1e-8));
    if (index !== lastIndex) {
      lastIndex = index;
      const sample = race.samples[index];
      const x = curveX(index * DUEL.step).toFixed(2);
      get('duel-time').textContent = timeFormat.format(index * DUEL.step);
      get('duel-cursor').setAttribute('d', `M${x} 0V155`);
      for (const [name, ui] of Object.entries(lanes)) {
        const lane = sample[name];
        ui.rpm.textContent = integer.format(lane.rpm);
        ui.duty.textContent = `${percent.format(lane.duty)}%`;
        ui.path.setAttribute('d', paths[name].slice(0, index + 1).join(''));
        ui.dot.setAttribute('cx', x);
        ui.dot.setAttribute('cy', curveY(lane.rpm).toFixed(2));
        ui.rotor.setAttribute('transform', `rotate(${reduced.matches ? 0 : (lane.angle % 360).toFixed(2)})`);
      }
      if (paths.baseline) baselineLine.setAttribute('d', paths.baseline.slice(0, index + 1).join(''));
    }
    showStage(time < DUEL.onset ? 0 : time < DUEL.release ? 1 : 2);
  }

  function renderButtons() {
    run.textContent = { ready: 'Mulai duel', running: 'Jeda', paused: 'Lanjutkan', finished: 'Ulangi duel' }[state];
    reset.disabled = state === 'ready';
    const inProgress = state === 'running' || state === 'paused';
    pit.disabled = inProgress;
    for (const choice of choices) {
      choice.disabled = inProgress;
      choice.setAttribute('aria-pressed', Number(choice.dataset.duelLoad) === load);
    }
  }

  function renderPit() {
    const profile = Object.keys(PI_PROFILES).find((key) => sameGains(gains, PI_PROFILES[key]));
    get('pit-profile-name').textContent = { default: 'PI bawaan', smooth: 'Redam lonjakan', quick: 'Pulih cepat' }[profile] ?? 'Setelan kustom';
    for (const button of profiles) button.setAttribute('aria-pressed', profile === button.dataset.piProfile);
    for (const [input, value] of [[kp, gains.kp], [ki, gains.ki]]) {
      input.value = value;
      const range = Number(input.max) - Number(input.min);
      input.style.setProperty('--position', `${100 * (value - Number(input.min)) / range}%`);
      get(input.id + '-value').textContent = gainFormat.format(value);
      input.setAttribute('aria-valuetext', gainFormat.format(value));
    }
    get('pit-caption').textContent = `Simulasi beban ${load}%`;
    for (const [key, score] of [['base', baseline.scores.hold], ['tune', race.scores.hold]]) {
      get(`pit-${key}-mae`).textContent = `${integer.format(score.mae)} RPM`;
      get(`pit-${key}-peak`).textContent = `+${integer.format(Math.max(0, score.max - DUEL.rpm))} RPM`;
      get(`pit-${key}-settle`).textContent = score.settle === null ? '>4 dtk' : `${decimal.format(score.settle)} dtk`;
    }
  }

  function prepare() {
    baseline = simulateDuel(load);
    const tuned = !sameGains(gains, PI_DEFAULT);
    race = tuned ? simulateDuel(load, gains) : baseline;
    const makePath = (samples, name) => samples.map((sample, index) =>
        `${index ? 'L' : 'M'}${curveX(index * DUEL.step).toFixed(2)} ${curveY(sample[name].rpm).toFixed(2)}`,
    );
    paths = Object.fromEntries(Object.keys(lanes).map((name) => [name, makePath(race.samples, name)]));
    if (tuned) paths.baseline = makePath(baseline.samples, 'hold');
    baselineLine.toggleAttribute('hidden', !tuned);
    get('duel-baseline-legend').hidden = !tuned;
    time = 0;
    lastIndex = -1;
    state = 'ready';
    resultPanel.hidden = true;
    get('duel-announcement').textContent = '';
    renderPit();
    render();
    renderButtons();
  }

  function finish() {
    state = 'finished';
    const { fixed, hold } = race.scores;
    const gain = Math.round(100 * (fixed.mae - hold.mae) / fixed.mae);
    const headline = gain === 0 ? 'Galat RPM setara.' : `Galat RPM ${gain > 0 ? 'turun' : 'naik'} ${Math.abs(gain)}%.`;
    get('duel-result-title').textContent = headline;
    get('duel-result-copy').textContent = `Dengan beban ${load}%, putaran terendah mencapai ${integer.format(fixed.min)} RPM dengan duty tetap dan ${integer.format(hold.min)} RPM dengan Tahan RPM. Setelah beban lepas, Tahan RPM sempat mencapai ${integer.format(hold.max)} RPM.`;
    get('duel-score-fixed').textContent = integer.format(fixed.mae);
    get('duel-score-hold').textContent = integer.format(hold.mae);
    resultPanel.hidden = false;
    get('duel-announcement').textContent = `Duel selesai. ${headline}`;
    renderButtons();
  }

  function tickDuel(now) {
    frameId = 0;
    time = Math.min(DUEL.duration, (now - startedAt) / 1000);
    if (time >= DUEL.duration) finish();
    render();
    if (state === 'running') frameId = requestAnimationFrame(tickDuel);
  }

  function pauseDuel() {
    if (state !== 'running') return;
    cancelAnimationFrame(frameId);
    state = 'paused';
    render();
    renderButtons();
  }

  mode.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    get('bench-page').hidden = open;
    mode.setAttribute('aria-pressed', open);
    if (!open) pauseDuel();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseDuel();
  });
  run.addEventListener('click', () => {
    if (state === 'running') {
      pauseDuel();
      return;
    }
    if (state === 'finished') prepare();
    state = 'running';
    startedAt = performance.now() - time * 1000;
    frameId = requestAnimationFrame(tickDuel);
    renderButtons();
  });
  reset.addEventListener('click', () => {
    cancelAnimationFrame(frameId);
    prepare();
    run.focus();
  });
  for (const choice of choices) {
    choice.addEventListener('click', () => {
      load = Number(choice.dataset.duelLoad);
      prepare();
    });
  }
  for (const profile of profiles) {
    profile.addEventListener('click', () => {
      gains = { ...PI_PROFILES[profile.dataset.piProfile] };
      prepare();
    });
  }
  for (const input of [kp, ki]) {
    input.addEventListener('input', () => {
      gains = { kp: kp.valueAsNumber, ki: ki.valueAsNumber };
      prepare();
    });
  }
  get('duel-export').addEventListener('click', () => {
    const data = new Blob([duelCsv(load, gains, race, baseline)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `duel-dyno-${load}pct.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  reduced.addEventListener('change', () => {
    lastIndex = -1;
    render();
  });
  prepare();
}

mountDuel();
