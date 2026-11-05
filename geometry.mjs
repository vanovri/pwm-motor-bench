import * as iso from './kit/iso-kit.mjs';
import * as turn from './kit/lathe.mjs';
import * as audit from './kit/audit.mjs';
import { SIGNAL, measure, waveform } from './model.mjs';

const width = 780;
const height = 400;
const table = { x: -176, y: -92, w: 352, d: 204, r: 9 };
const casePlan = { x: -156, y: -76, w: 163, d: 61, r: 4 };
const P = iso.fitProjection(
  [...iso.boxCorners(table, -16, 0), ...iso.boxCorners(casePlan, 0, 112), [94, 58, 98], [94, -50, 98]],
  width, height, { azimuth: 62, elevation: 29, pad: 26 },
);
const R = audit.recorder(P);
const project = (x, y, z) => iso.iso([x, y, z], P);
const solidStyle = (className, tone = 'mid') => ({ className, tone, crease: 'lo' });

function place(name, at, shapes, svg) {
  const id = R.nameFor(name);
  R.put({ name: id, at, shapes: shapes.map((shape) => R.solid({ ...shape, name: id, ground: name === 'boot' })), svg });
}

function slabShape(x, y, w, d, z, h, r, bevel) {
  const plan = { x, y, w, d, r };
  return {
    path: iso.slabOf(plan, z, h, P, 5, bevel),
    shape: audit.slab(plan, z, h, {}, 5),
    center: [x + w / 2, y + d / 2, z + h / 2],
  };
}

function slab(name, x, y, w, d, z, h, { r = 0, bevel = 0, paint = 'alloy', tone, overlay = '' } = {}) {
  const { path, shape, center } = slabShape(x, y, w, d, z, h, r, bevel);
  place(name, center, [shape], iso.solidSvg(path, solidStyle(paint, tone)) + overlay);
}

function face(x, y, z, markup) {
  const [a, b] = project(x, y, z);
  const [c, d] = project(x + 1, y, z);
  const [e, f] = project(x, y, z - 1);
  return `<g transform="matrix(${c - a} ${d - b} ${e - a} ${f - b} ${a} ${b})">${markup}</g>`;
}

function screws(points, radius = 1.6) {
  return points.map(([x, y, z]) => iso.lineSvg(iso.ring(x, y, radius, z, P, 20), { tone: 'mid' })
    + iso.dotsSvg([project(x, y, z)], { size: 0.6, tone: 'mid' })).join('');
}

function base() {
  for (const [x, y] of iso.corners(table, 17)) {
    slab('boot', x - 11, y - 8, 22, 16, -16, 4, { r: 2, paint: 'rubber' });
    slab('pedestal', x - 10, y - 7, 20, 14, -12, 5, { r: 2, paint: 'graphite' });
  }
  slab('bench frame', table.x, table.y, table.w, table.d, -7, 5, { r: table.r, paint: 'graphite' });
  const groove = iso.lineSvg(iso.planOutline(iso.insetPlan(table, 5), 0, P, 5), { tone: 'lo' });
  slab('bench deck', table.x, table.y, table.w, table.d, -2, 2, {
    r: table.r, bevel: 0.4, paint: 'deck',
    overlay: groove + screws(iso.corners(table, 10).map(([x, y]) => [x, y, 0]), 2),
  });
  const label = iso.faceTextSvg(iso.topMatrix([22.5, 101], 1, P), 'SB / 02', { size: 5.3, anchor: 'middle', tone: 'hi' });
  slab('bench plate', 2, 92, 41, 14, 0, 1, { r: 1.4, paint: 'graphite', overlay: label });
}

function scope() {
  for (const x of [-144, -26]) {
    slab('scope boot', x, -68, 22, 46, 0, 4, { r: 2, paint: 'rubber' });
    slab('scope riser', x + 2, -66, 18, 42, 4, 4, { r: 1, paint: 'graphite' });
  }
  const grid = Array.from({ length: 11 }, (_, i) => `M${i * 10.6} 0V49`)
    .concat(Array.from({ length: 6 }, (_, i) => `M0 ${i * 9.8}H106`)).join('');
  const display = face(-145, -15, 92, `<rect width="106" height="61" class="scope-glass"/>
    <g transform="translate(0 6)"><path d="${grid}" class="scope-grid"/>
    <path id="scope-trace" class="signal" d="${waveform(SIGNAL.duty, 106, 9.8, 39.2)}"/></g>`);
  slab('scope case', casePlan.x, casePlan.y, casePlan.w, casePlan.d, 8, 99, { r: 4, bevel: 1, paint: 'alloy', overlay: display });
  slab('scope lid', -155, -75, 161, 59, 107, 4, {
    r: 4, bevel: 0.75, paint: 'deck', overlay: screws([[-146, -64, 111], [-146, -24, 111], [-4, -24, 111], [-4, -64, 111]]),
  });
  slab('grille', -135, -66, 120, 11, 111, 0.75, { r: 1.8, paint: 'graphite' });
  for (let i = 0; i < 10; i++) {
    slab('slot', -130 + i * 11, -63, 7.8, 4.6, 111.75, 0.3, { r: 1.1, paint: 'rubber' });
  }
  slab('left bezel', -151, -15, 6, 3.7, 26, 72, { bevel: 0.5, paint: 'graphite' });
  slab('right bezel', -39, -15, 5, 3.7, 26, 72, { bevel: 0.5, paint: 'graphite' });
  slab('top bezel', -145, -15, 106, 3.7, 92, 6, { bevel: 0.45, paint: 'graphite' });
  slab('bottom bezel', -145, -15, 106, 3.7, 26, 5, { bevel: 0.45, paint: 'graphite' });
  slab('scope keypad', -28, -15, 26, 2.4, 27, 70, { bevel: 0.4, paint: 'deck' });
  const initialRpm = Math.round(measure(SIGNAL.duty, SIGNAL.load).target);
  const tach = face(-25, -10.6, 90, `<rect width="20" height="11" rx="1" class="scope-glass"/>
    <text id="scope-rpm" x="10" y="7.5" class="tach-screen" text-anchor="middle">${initialRpm}</text>`);
  slab('tachometer', -25, -12.6, 20, 2, 79, 11, { paint: 'graphite', overlay: tach });
  for (const z of [65, 52, 39]) {
    for (const x of [-24, -14]) slab('key', x, -12.6, 7, 2, z, 7.5, { bevel: 0.4, paint: 'alloy' });
  }
  for (const x of [-154, 0]) slab('bumper', x, -15, 3, 3, 19, 82, { bevel: 0.3, paint: 'rubber' });
}

const F = turn.frameAlong([93, -49, 54], [0, 1, 0]);
function turned(name, profile, { paint = 'alloy', tone, overlay = '' } = {}) {
  const center = [F.o[0], F.o[1] + (profile[0][0] + profile.at(-1)[0]) / 2, F.o[2]];
  const paths = turn.lathe(profile, F, P, { steps: 80 });
  place(name, center, [audit.lathe(F, profile)], iso.solidSvg(paths, solidStyle(paint, tone)) + overlay);
}
const annulus = (a, b, inner, outer) => [[a, inner], [a, outer], [b, outer], [b, inner]];

function motor() {
  for (const y of [-36, 13]) {
    slab('motor plinth', 55, y, 76, 10, 0, 4, { r: 2, bevel: 0.5, paint: 'graphite' });
    slab('motor saddle', 64, y + 1, 58, 8, 4, 12, {
      bevel: 0.65, paint: 'alloy', overlay: screws([[69, y + 5, 16], [117, y + 5, 16]]),
    });
  }
  turned('rear end cap', [[-6, 0], [-6, 28], [-4, 33], [0, 33], [0, 0]], { paint: 'graphite' });
  const housing = [[0, 0], [0, 35], [4, 38]];
  for (let s = 25; s <= 57; s += 4) {
    housing.push([s, 38], [s + 0.25, 39.8], [s + 0.55, 40.2], [s + 1.65, 40.2], [s + 1.95, 39.8], [s + 2.2, 38]);
  }
  housing.push([71, 38], [74, 35], [74, 0]);
  turned('finned motor housing', housing, { paint: 'alloy' });
  turned('motor adapter', [[74, 0], [74, 35], [76, 36], [80, 36], [80, 0]], { paint: 'graphite' });
  turned('inner shaft', annulus(80, 112, 0, 6), { paint: 'alloy' });
  turned('fan shroud', [[80, 32], [80, 36], [84, 43], [106, 43], [110, 41], [110, 32]], { paint: 'gunmetal' });

  const blades = Array.from({ length: 7 }, (_, i) => `<path transform="rotate(${i * 360 / 7})" d="M7 -4C11 -15 18 -25 26 -14C26 -8 19 -3 9 0Z"/>`).join('');
  const rotor = face(93, -49 + 115, 54, `<circle r="30.9" class="rotor-plate"/>
    <g id="rotor" transform="rotate(0)">${blades}<circle r="7.1" class="rotor-hub"/>
    <path class="rotor-mark" d="M0 -6V-3"/></g>`);
  turned('fan impeller', annulus(112, 115, 0, 31), { paint: 'rubber', overlay: rotor });
  turned('shaft cap', [[115, 0], [115, 6], [116, 6.4], [117, 5.6], [117, 0]], { paint: 'graphite' });

  const bolts = Array.from({ length: 8 }, (_, i) => {
    const angle = i * Math.PI / 4;
    const x = (Math.cos(angle) * 38.8).toFixed(2);
    const y = (Math.sin(angle) * 38.8).toFixed(2);
    return `<g transform="translate(${x} ${y})"><circle r="1.8" class="bolt"/><path d="M-1 0H1" class="bolt-slot"/></g>`;
  }).join('');
  const rim = face(93, -49 + 112, 54, `<circle r="40.8" class="ring-engraving"/>${bolts}`);
  turned('front retaining ring', [[110, 32], [110, 41], [111, 42], [112, 42], [112, 32]], { paint: 'alloy', overlay: rim });
}

function driver() {
  slab('driver tray', -29, 8, 63, 34, 0, 3, { r: 2, bevel: 0.5, paint: 'graphite' });
  const holes = screws([[-25, 12, 4.4], [30, 12, 4.4], [-25, 38, 4.4], [30, 38, 4.4]], 1);
  slab('driver circuit board', -28, 9, 61, 32, 3, 1.4, { r: 1.2, paint: 'pcb', overlay: holes });
  slab('driver chip', -9, 17, 16, 14, 4.4, 3, { bevel: 0.4, paint: 'rubber' });
  for (const y of [15, 31]) {
    for (let i = 0; i < 4; i++) slab('chip leg', -8 + i * 4, y, 1.5, 2, 4.4, 0.45, { paint: 'alloy' });
  }
  for (const y of [16, 27]) slab('terminal', 21, y, 7, 8, 4.4, 5, { bevel: 0.3, paint: 'gunmetal' });
  for (const x of [-21, -16, 10, 15]) slab('passive', x, 22, 3, 6, 4.4, 1.7, { bevel: 0.25, paint: 'copper' });
  slab('test pads', -7, 34, 25, 3.5, 4.4, 0.5, { paint: 'alloy' });
}

const track = { x: -133, y: 68, z: 10, length: 125 };
export const geometry = {
  trackStart: project(track.x, track.y, track.z),
  trackEnd: project(track.x + track.length, track.y, track.z),
};

function fader() {
  slab('fader case', -154, 44, 168, 48, 0, 7, { r: 4, bevel: 0.75, paint: 'graphite' });
  slab('fader face', -152, 46, 164, 44, 7, 3, {
    r: 2.5, bevel: 0.6, paint: 'deck', overlay: screws([[-147, 51, 10], [7, 85, 10]]),
  });
  slab('slide channel', -146, 62, 151, 12, 10, 0.65, { r: 1.3, paint: 'rubber' });
  for (const y of [60, 74]) slab('rail', -146, y, 151, 2, 10, 2, { paint: 'graphite' });
  for (const x of [-148, 5]) slab('slide stop', x, 60, 2, 16, 10, 3, { bevel: 0.2, paint: 'alloy' });
  const ticks = iso.topTicks(-133, -8, 6.25, 5, 49, 10.65, [2.7, 4.4], P);
  slab('ruler strip', -140, 49, 140, 7, 10, 0.65, {
    paint: 'graphite', overlay: iso.lineSvg(ticks.minor, { tone: 'mid' }) + iso.lineSvg(ticks.major, { tone: 'hi' }),
  });

  const pieces = [
    [track.x - 3, 65, 6, 6, 10.65, 2.35, 0, 0, 'alloy'],
    [track.x - 9, 59, 18, 18, 13, 5, 1.4, 0.6, 'copper'],
    ...[-4, 0, 4].map((offset) => [track.x + offset - 0.6, 62, 1.2, 12, 18, 0.6, 0.25, 0, 'copper-dark']),
  ];
  const shift = track.length * SIGNAL.duty / 100;
  const art = pieces.map(([x, y, w, d, z, h, r, bevel, paint]) => {
    const { path, shape } = slabShape(x, y, w, d, z, h, r, bevel);
    return { shape: audit.moved(shape, [shift, 0, 0]), svg: iso.solidSvg(path, solidStyle(paint, 'hi')) };
  });
  place('fader handle', [track.x + shift, track.y, 14], art.map(({ shape }) => shape),
    `<g id="fader-cap" transform="${iso.translateAlong(P, [shift, 0, 0])}">${art.map(({ svg }) => svg).join('')}</g>`);
}

export function buildFigure() {
  base();
  scope();
  motor();
  driver();
  fader();
  audit.settle(R, P);
  audit.auditOrExit(R, P);
  const hit = [[-147, 51], [5, 51], [5, 86], [-147, 86]].map(([x, y]) => project(x, y, track.z));
  const halo = `<path class="iso-halo" d="${iso.haloOf(table, -16, 13, P)}"/>`;
  const body = R.items.sort((a, b) => a.key - b.key).map(({ svg }) => svg);
  return {
    count: R.solids.length,
    svg: iso.figureSvg({
      width, height, label: 'Meja uji isometrik dengan osiloskop, fader PWM dan kipas motor DC.',
      body: [halo, ...body, `<path id="fader-hit" d="${iso.pathOf(hit, true)}"/>`],
    }),
  };
}
