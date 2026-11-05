const get = (id) => document.getElementById(id);
const dutyInput = get('duty');
const loadInput = get('load');
const faderCap = get('fader-cap');
const faderHit = get('fader-hit');
const scene = faderCap.ownerSVGElement;
const rotor = get('rotor');
const motionButton = get('motion');
const scopeRpm = get('scope-rpm');
const rpmValue = get('rpm');
const machineState = get('machine-state');
const historyPath = get('speed-history');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const presets = [...document.querySelectorAll('[data-duty]')];
const loadSteps = [...document.querySelectorAll('[data-load-step]')];
const holdButton = get('hold');
const setpointInput = get('setpoint');
const teardownButton = get('teardown-toggle');
const partButtons = [...document.querySelectorAll('[data-inspect]')];
const assemblies = [...document.querySelectorAll('.assembly')];
const teardownRotors = [...document.querySelectorAll('[data-spinning]')];
const integer = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

const [startX, startY] = geometry.trackStart;
const dx = geometry.trackEnd[0] - startX;
const dy = geometry.trackEnd[1] - startY;

let duty = SIGNAL.duty;
let load = SIGNAL.load;
let result = measure(duty, load);
let rpm = result.target;
let faderDuty = duty;
let displayedRpm = -1;
let angle = 0;
let frame = 0;
let last = 0;
let sampleTime = 0;
let visible = true;
let pause = false;
let teardown = false;
let hold = false;
let setpoint = SPEED_HOLD.initial;
let integral = 0;
let controlTime = 0;
let separation = [];
const history = Array(51).fill(rpm);

function renderRpm() {
  const rounded = Math.round(rpm);
  if (rounded === displayedRpm) return;
  displayedRpm = rounded;
  rpmValue.textContent = integer.format(rounded);
  scopeRpm.textContent = rounded;
  const limited = hold && duty === 100 && setpoint - rpm > 25;
  machineState.textContent = limited ? 'PWM maksimum' : duty > 0 ? 'Motor aktif' : rounded > 0 ? 'Melambat' : 'Motor berhenti';
  machineState.dataset.limited = limited;
  machineState.dataset.active = rounded > 0 || duty > 0 ? 'true' : 'false';
}

function renderHistory() {
  const path = history.map((value, i) => {
    const y = 38 - 34 * value / MOTOR.freeRpm;
    return `${i === 0 ? 'M' : 'L'}${i * 4.4} ${y.toFixed(2)}`;
  }).join('');
  historyPath.setAttribute('d', path);
}

function placeFader() {
  faderCap.setAttribute('transform', `translate(${dx * faderDuty / 100} ${dy * faderDuty / 100})`);
}

function renderRotor() {
  const rotation = `rotate(${angle.toFixed(2)})`;
  rotor.setAttribute('transform', rotation);
  if (teardown) {
    for (const detail of teardownRotors) detail.setAttribute('transform', rotation);
  }
}

function tick(now) {
  if (!visible || document.hidden) {
    frame = 0;
    return;
  }
  const dt = last ? Math.min((now - last) / 1000, 0.075) : 0;
  last = now;
  const prev = rpm;
  rpm = advance(rpm, result.target, result.tau, dt);
  if (Math.abs(rpm - result.target) < 0.2) rpm = result.target;
  if (hold) {
    controlTime += dt;
    if (controlTime >= 0.035) {
      const command = controlSpeed(setpoint, rpm, integral, controlTime);
      integral = command.integral;
      controlTime = 0;
      if (command.duty !== duty) update(command.duty, load);
    }
  }
  renderRpm();
  if (!pause && !reduced.matches) {
    if (rpm > 0 || prev > 0) {
      angle = (angle + (rpm + prev) / 2 * 6 * dt / MOTOR.visualReduction) % 360;
      renderRotor();
    }
    if (Math.abs(duty - faderDuty) > 0.05) {
      faderDuty = advance(faderDuty, duty, 0.055, dt);
      placeFader();
    } else if (faderDuty !== duty) {
      faderDuty = duty;
      placeFader();
    }
    sampleTime += dt;
    if (sampleTime >= 0.1) {
      sampleTime %= 0.1;
      history.shift();
      history.push(rpm);
      renderHistory();
    }
  }
  if (hold || rpm !== result.target || (!pause && !reduced.matches)) {
    frame = requestAnimationFrame(tick);
  } else {
    frame = 0;
  }
}

function start() {
  if (frame || !visible || document.hidden) return;
  last = 0;
  frame = requestAnimationFrame(tick);
}

function update(dutyValue, loadValue) {
  duty = dutyValue;
  load = loadValue;
  result = measure(duty, load);
  dutyInput.value = duty;
  loadInput.value = load;
  for (const input of [dutyInput, loadInput]) {
    input.style.setProperty('--position', `${input.value}%`);
    input.setAttribute('aria-valuetext', `${percent.format(input.valueAsNumber)} persen`);
  }
  const dutyText = percent.format(duty);
  const highTime = Math.round(result.highTime);
  get('duty-value').textContent = dutyText + '%';
  get('load-value').textContent = load + '%';
  get('high-time').textContent = highTime;
  get('avg-voltage').textContent = decimal.format(result.average);
  get('target').textContent = integer.format(hold ? setpoint : result.target);
  get('figure-readout').textContent = dutyText + '% DUTY';
  get('scope-trace').setAttribute('d', waveform(duty, 106, 9.8, 39.2));
  get('plot-trace').setAttribute('d', waveform(duty, 220, 12, 59));
  get('plot').setAttribute('aria-label', `PWM ${dutyText} persen. Sinyal HIGH selama ${highTime} mikrodetik setiap periode.`);
  for (const preset of presets) {
    preset.setAttribute('aria-pressed', Number(preset.dataset.duty) === duty && Number(preset.dataset.load) === load);
  }
  for (const step of loadSteps) step.setAttribute('aria-pressed', Number(step.dataset.loadStep) === load);
  displayedRpm = -1;
  renderRpm();
  if (pause || reduced.matches) {
    faderDuty = duty;
    placeFader();
  }
  start();
}

function updateHint() {
  get('figure-hint').textContent = teardown ? 'Pilih bagian yang mau lo lihat'
    : hold ? 'Fader otomatis mengikuti kontrol RPM' : 'Geser fader pada ilustrasi';
}

function renderSetpoint() {
  const { minimum, maximum } = SPEED_HOLD;
  setpointInput.style.setProperty('--position', `${100 * (setpoint - minimum) / (maximum - minimum)}%`);
  setpointInput.setAttribute('aria-valuetext', `${integer.format(setpoint)} RPM`);
  get('setpoint-value').textContent = `${integer.format(setpoint)} RPM`;
  get('target-label').textContent = hold ? 'SETPOINT' : 'RPM STABIL';
  const line = get('speed-setpoint');
  line.toggleAttribute('hidden', !hold);
  line.setAttribute('d', `M0 ${38 - 34 * setpoint / MOTOR.freeRpm}H220`);
}

function setHold(enabled, nextDuty = enabled ? duty : Math.round(duty)) {
  hold = enabled;
  controlTime = 0;
  integral = startHold(setpoint, rpm, nextDuty);
  holdButton.setAttribute('aria-pressed', enabled);
  get('hold-config').hidden = !enabled;
  get('manual-presets').hidden = enabled;
  get('hold-presets').hidden = !enabled;
  dutyInput.step = enabled ? '0.1' : '1';
  dutyInput.disabled = enabled;
  faderHit.classList.toggle('automatic', enabled);
  updateHint();
  renderSetpoint();
  update(nextDuty, load);
}

dutyInput.addEventListener('input', () => update(dutyInput.valueAsNumber, load));
loadInput.addEventListener('input', () => update(duty, loadInput.valueAsNumber));
holdButton.addEventListener('click', () => setHold(!hold));
setpointInput.addEventListener('input', () => {
  setpoint = setpointInput.valueAsNumber;
  renderSetpoint();
  update(duty, load);
});
for (const button of presets) {
  button.addEventListener('click', () => update(Number(button.dataset.duty), Number(button.dataset.load)));
}
for (const button of loadSteps) {
  button.addEventListener('click', () => update(duty, Number(button.dataset.loadStep)));
}
get('coast').addEventListener('click', () => setHold(false, 0));

function dragFader(event) {
  if (hold) return;
  const pointer = new DOMPoint(event.clientX, event.clientY).matrixTransform(scene.getScreenCTM().inverse());
  const fraction = ((pointer.x - startX) * dx + (pointer.y - startY) * dy) / (dx * dx + dy * dy);
  update(Math.round(Math.min(1, Math.max(0, fraction)) * 100), load);
}
faderHit.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  faderHit.setPointerCapture(event.pointerId);
  dragFader(event);
});
faderHit.addEventListener('pointermove', (event) => {
  if (faderHit.hasPointerCapture(event.pointerId)) dragFader(event);
});

const partDescriptions = {
  stator: ['Stator', 'Magnet diam membentuk medan tempat rotor berputar.'],
  armature: ['Rotor', 'Arus di lilitan menghasilkan torsi. Komutator menukar arah arus saat poros berputar.'],
  fan: ['Kipas', 'Poros memutar kipas. Saat RPM turun, kipas juga melambat.'],
};

function selectPart(name) {
  const [title, description] = partDescriptions[name];
  const label = document.createElement('strong');
  label.textContent = title + '.';
  get('part-copy').replaceChildren(label, ' ' + description);
  for (const button of partButtons) button.setAttribute('aria-pressed', button.dataset.inspect === name);
  for (const part of assemblies) part.classList.toggle('selected', part.dataset.part === name);
}

function spreadParts() {
  for (const animation of separation) animation.cancel();
  separation = teardown ? assemblies.map((part) => part.animate([
    { transform: 'translate(0px, 0px)' },
    { transform: `translate(${part.dataset.x}px, ${part.dataset.y}px)` },
  ], { duration: reduced.matches || pause ? 0 : 540, easing: 'cubic-bezier(.2,.65,.3,1)', fill: 'both' })) : [];
}

teardownButton.addEventListener('click', () => {
  teardown = !teardown;
  teardownButton.setAttribute('aria-pressed', teardown);
  get('bench-view').hidden = teardown;
  get('teardown-view').hidden = !teardown;
  get('figure-title').textContent = teardown ? 'TAMPAK BONGKAR' : 'RIG MOTOR DC';
  spreadParts();
  renderRotor();
  updateHint();
});
for (const button of partButtons) button.addEventListener('click', () => selectPart(button.dataset.inspect));
for (const part of assemblies) part.addEventListener('click', () => selectPart(part.dataset.part));
selectPart('stator');

const theme = get('theme');
function applyTheme(light) {
  document.body.dataset.theme = light ? 'light' : 'dark';
  theme.setAttribute('aria-pressed', light);
}
theme.addEventListener('click', () => applyTheme(document.body.dataset.theme === 'dark'));
applyTheme(document.body.dataset.theme === 'light');

function syncMotionButton() {
  motionButton.disabled = reduced.matches;
  motionButton.setAttribute('aria-pressed', pause || reduced.matches);
  motionButton.querySelector('span').textContent = reduced.matches ? 'Gerak minimal' : pause ? 'Animasi dijeda' : 'Jeda animasi';
}
motionButton.addEventListener('click', () => {
  pause = !pause;
  if (pause) spreadParts();
  syncMotionButton();
  update(duty, load);
});
reduced.addEventListener('change', () => {
  if (reduced.matches) spreadParts();
  syncMotionButton();
  update(duty, load);
});

const visiblePanels = new Set();
const visibility = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) visiblePanels.add(entry.target);
    else visiblePanels.delete(entry.target);
  }
  visible = visiblePanels.size > 0;
  if (visible) start();
});
visibility.observe(get('experiment'));
visibility.observe(document.querySelector('.instruments'));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) start();
});
syncMotionButton();
renderHistory();
renderRpm();
update(duty, load);
