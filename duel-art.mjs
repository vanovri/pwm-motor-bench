import * as iso from './kit/iso-kit.mjs';
import * as turn from './kit/lathe.mjs';
import * as audit from './kit/audit.mjs';

export function buildDuelMotor() {
  const W = 248;
  const H = 143;
  const F = turn.frameAlong([0, 0, 0], [0, 1, 0]);
  const stand = { x: -48, y: -45, w: 96, d: 98, r: 6 };
  const P = iso.fitProjection(iso.boxCorners(stand, -41, 31), W, H, { azimuth: 56, elevation: 25, pad: 10 });
  const R = audit.recorder(P);
  const put = (name, at, shape, art) => R.put({ name, at, shapes: [R.solid({ ...shape, name })], svg: art });
  const slab = (name, plan, z, h, paint, ground = false) => put(name, [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2],
    audit.slab(plan, z, h, { ground }, 5), iso.solidSvg(iso.slabOf(plan, z, h, P, 5, .65), { className: paint, tone: 'mid' }));
  const [x, y] = iso.iso([0, 46, 0], P);
  const [a, b] = iso.iso([1, 46, 0], P);
  const [c, d] = iso.iso([0, 46, -1], P);
  const front = `matrix(${a - x} ${b - y} ${c - x} ${d - y} ${x} ${y})`;
  const housing = [[-38, 0], [-38, 24], [-35, 28], [-27, 28]];
  for (let s = -25; s <= 17; s += 6) housing.push([s, 28], [s + 1, 30], [s + 3, 30], [s + 4, 28]);
  housing.push([29, 28], [32, 31], [43, 31], [46, 29], [46, 0]);
  const blades = Array.from({ length: 7 }, (_, i) =>
    `<path transform="rotate(${i * 360 / 7})" d="M5.5 -3C9 -12 14 -19 20 -11C20 -6 15 -2 7 0Z"/>`,
  ).join('');
  const bolts = Array.from({ length: 6 }, (_, i) =>
    `<circle class="bolt" transform="rotate(${i * 60})" r="1.35" cx="26.5"/>`,
  ).join('');
  slab('duel deck', stand, -41, 4, 'deck', true);
  for (const t of [-37, 21.5]) slab(`duel mount ${t}`, { x: -28, y: t, w: 56, d: 7, r: 1.5 }, -37, 9, 'graphite');
  const cap = `<g transform="${front}"><circle r="28.6" class="duel-rim"/><circle r="22" class="rotor-plate"/>${bolts}
    <g data-duel-rotor="">${blades}<circle class="duel-hub" r="5.4"/><path class="duel-mark" d="M0 -4v2"/></g></g>`;
  put('duel motor', [0, 4, 0], audit.lathe(F, housing),
    iso.solidSvg(turn.lathe(housing, F, P, { steps: 64 }), { className: 'alloy', tone: 'mid' }) + cap);
  audit.settle(R, P);
  audit.auditOrExit(R, P);
  return iso.figureSvg({
    width: W, height: H, className: 'duel-motor', label: 'Motor uji isometrik',
    body: R.items.sort((first, second) => first.key - second.key).map(({ svg }) => svg),
  });
}
