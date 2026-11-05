import assert from 'node:assert/strict';
import * as iso from './kit/iso-kit.mjs';
import * as turn from './kit/lathe.mjs';
import * as audit from './kit/audit.mjs';

const width = 780;
const height = 321;
const groups = [
  { name: 'stator', origin: -111, from: -37, to: 37, move: -18 },
  { name: 'armature', origin: 0, from: -47, to: 46, move: 0 },
  { name: 'fan', origin: 78, from: -9, to: 10, move: 31 },
];

const bounds = groups.flatMap(({ origin, from, to, move }) =>
  iso.boxCorners({ x: origin + from + Math.min(move, 0), y: -43, w: to - from + Math.abs(move), d: 86 }, -43, 43),
);
const P = iso.fitProjection(bounds, width, height, { azimuth: 59, elevation: 21, pad: 24 });

function section({ name, origin, from, to, move }, recorder) {
  const F = turn.frameAlong([origin, 0, 0], [1, 0, 0]);
  const chunks = [];
  let tail = from;
  const point = (s, r, angle) => iso.iso(turn.pointOf(F, s, r, angle), P);
  const solid = (profile, paint, front = '', separate = false) => {
    const axial = profile.map(([x]) => x);
    const start = Math.min(...axial);
    const end = Math.max(...axial);
    assert.ok(start >= tail && end <= to, `Overlapping axial bands: ${name}`);
    tail = end;
    const svg = iso.solidSvg(turn.lathe(profile, F, P, { steps: 84 }), { className: paint, tone: 'mid', crease: 'lo' }) + front;
    const id = recorder.nameFor(name);
    const shape = recorder.solid(audit.lathe(F, profile, { name: id, ground: chunks.length === 0 || separate }));
    chunks.push(recorder.put({ piece: name, name: id, at: [origin + (start + end) / 2, 0, 0], shapes: [shape], svg }));
  };
  const flat = (s, markup) => {
    const [x, y] = point(s, 0, 0);
    const [ux, uy] = point(s, 1, 0);
    const [vx, vy] = point(s, 1, Math.PI / 2);
    return `<g transform="matrix(${ux - x} ${uy - y} ${vx - x} ${vy - y} ${x} ${y})">${markup}</g>`;
  };
  const draw = () => {
    const [x, y] = iso.iso([move, 0, 0], P);
    const [zeroX, zeroY] = iso.iso([0, 0, 0], P);
    const art = chunks.sort((a, b) => a.key - b.key).map(({ svg }) => svg).join('');
    return `<g class="assembly" data-part="${name}" data-x="${x - zeroX}" data-y="${y - zeroY}">${art}</g>`;
  };
  return { solid, flat, point, draw };
}

const disc = (a, b, r) => [[a, 0], [a, r], [b, r], [b, 0]];
const ring = (a, b, low, high) => [[a, low], [a, high], [b, high], [b, low]];
const repeats = (n, markup) => Array.from({ length: n }, (_, i) =>
  `<g transform="rotate(${i * 360 / n})">${markup}</g>`,
).join('');

function stator(part) {
  const profile = [[-37, 23], [-37, 34], [-34, 38], [-27, 38], [-25, 34]];
  for (let x = -21; x <= 20; x += 5) {
    profile.push([x, 34], [x + .35, 36.5], [x + 2.5, 36.5], [x + 2.85, 34]);
  }
  profile.push([26, 34], [28, 40], [33, 40], [37, 38], [37, 27], [30, 27], [30, 23]);
  const poles = repeats(2, '<path class="field-pole" d="M17 -15A23 23 0 0 1 17 15L20.2 17.8A27 27 0 0 0 20.2 -17.8Z"/>');
  const screws = repeats(6, '<circle class="bolt" cx="33" r="1.9"/><path class="bolt-slot" d="M32 0h2"/>');
  part.solid(profile, 'alloy', part.flat(37, `<circle r="36" class="ring-engraving"/>${screws}`)
    + part.flat(37, poles));
}

function armature(part) {
  part.solid([[-47, 0], [-47, 4], [-46, 5.4], [-29, 5.4], [-29, 0]], 'alloy');
  const wrap = '<path class="rotor-groove" d="M8 0h7"/>';
  part.solid([[-29, 0], [-29, 11], [-26, 18], [-17, 20], [-14, 20], [-14, 0]], 'copper',
    part.flat(-14, `<g data-spinning="">${repeats(12, wrap)}</g>`));
  const core = [[-14, 0], [-14, 20], [-13, 22]];
  for (let x = -10; x <= 9; x += 3) {
    core.push([x, 22], [x + .25, 21], [x + .6, 21], [x + .85, 22]);
  }
  core.push([13, 22], [15, 20], [15, 0]);
  part.solid(core, 'gunmetal', part.flat(15, `<g data-spinning="">${repeats(9, '<path class="rotor-groove" d="M13 0h7"/>')}</g>`));
  part.solid([[15, 0], [15, 20], [21, 20], [25, 16], [29, 10], [29, 0]], 'copper');
  const lamellae = Array.from({ length: 10 }, (_, i) => {
    const a = i * Math.PI / 10 - .94;
    return iso.pathOf([
      part.point(30.6, 10, a - .018), part.point(36.5, 10, a - .018),
      part.point(36.5, 10, a + .018), part.point(30.6, 10, a + .018),
    ], true);
  }).join('');
  part.solid(disc(29, 37, 10), 'copper-dark', `<path class="commutator-slots" d="${lamellae}"/>`
    + part.flat(37, `<g data-spinning="">${repeats(10, '<path class="rotor-groove" d="M5 0h4"/>')}</g>`));
  part.solid([[37, 0], [37, 5.5], [45, 5.5], [46, 4.1], [46, 0]], 'alloy');
}

function fan(part) {
  part.solid(ring(-9, -2, 32, 38), 'gunmetal');
  const blades = repeats(7, '<path d="M7 -4C11 -15 18 -25 26 -14C26 -8 19 -3 9 0Z"/>');
  part.solid(disc(-2, 3, 31), 'rubber', part.flat(3, `<circle r="30.9" class="rotor-plate"/><g class="inspect-blades" data-spinning="">${blades}</g>`), true);
  part.solid([[3, 0], [3, 7.5], [5, 8.4], [9, 8.4], [10, 7], [10, 0]], 'alloy',
    part.flat(10, '<g data-spinning=""><path class="rotor-groove" d="M4 0h2"/></g>'));
}

export function buildTeardown() {
  const pieces = [stator, armature, fan];
  const recorder = audit.recorder(P);
  const sections = groups.map((group, i) => {
    const ahead = groups[i + 1];
    if (ahead) {
      const end = group.origin + group.to + Math.max(0, group.move);
      const next = ahead.origin + ahead.from + Math.min(0, ahead.move);
      assert.ok(end < next, 'Inspection assemblies must stay separated through the full slide');
    }
    const part = section(group, recorder);
    pieces[i](part);
    return part;
  });
  audit.settle(recorder, P);
  audit.auditOrExit(recorder, P);
  const body = sections.map((part) => part.draw());
  const datum = iso.segment([-169, 0, 0], [130, 0, 0], P);
  return iso.figureSvg({
    width, height, className: 'teardown-svg',
    label: 'Tampak bongkar motor DC. Rumah stator, rotor dengan komutator, lalu kipas tersusun pada satu poros.',
    body: [`<path class="assembly-datum" d="${datum}"/>`, ...body],
  });
}
