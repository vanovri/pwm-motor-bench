import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ISO_CSS } from './kit/iso-kit.mjs';
import { buildFigure, geometry } from './geometry.mjs';
import { buildTeardown } from './teardown.mjs';
import { buildDuelMotor } from './duel-art.mjs';
import { DUEL, PI_PROFILES, duelCsv, duelLoad, simulateDuel } from './duel-model.mjs';
import { SIGNAL, advance, controlSpeed, measure, startHold, waveform } from './model.mjs';

const idle = measure(0, 0);
const unloaded = measure(100, 0);
const loaded = measure(100, 100);
assert.equal(idle.target, 0);
assert.equal(unloaded.target, 3600);
assert.equal(loaded.target, 1500);
assert.equal(measure(50, 30).highTime, 500);
assert.equal(measure(50, 30).average, 6);
assert.ok(Math.abs(advance(0, unloaded.target, unloaded.tau, unloaded.tau) - 3600 * (1 - Math.exp(-1))) < 1e-9);
assert.ok(advance(0, 1000, 0.4, 1) < 1000);
assert.ok(advance(3000, 1000, 0.4, 1) > 1000);
assert.equal(waveform(0, 220, 12, 60), 'M0 60H220');
assert.equal(waveform(100, 220, 12, 60), 'M0 12H220');

const setpoint = 1800;
let rpm = setpoint;
let duty = 50;
let integral = startHold(setpoint, rpm, duty);
function runLoad(load) {
  for (let i = 0; i < 150; i++) {
    ({ duty, integral } = controlSpeed(setpoint, rpm, integral, 0.035));
    const { target, tau } = measure(duty, load);
    rpm = advance(rpm, target, tau, 0.035);
  }
}
runLoad(65);
assert.ok(Math.abs(rpm - setpoint) < 8 && duty > 94 && duty < 97);
runLoad(100);
assert.equal(duty, 100);
assert.ok(Math.abs(rpm - 1500) < 1);
runLoad(0);
assert.ok(Math.abs(rpm - setpoint) < 8 && duty > 49 && duty < 51);

assert.equal(duelLoad(DUEL.onset - DUEL.step, 65), 0);
assert.equal(duelLoad(DUEL.onset, 65), 65);
assert.equal(duelLoad(DUEL.release, 65), 0);
for (const level of [65, 100]) {
  const { samples, scores } = simulateDuel(level);
  const loadEnd = samples[Math.round(DUEL.release / DUEL.step)];
  assert.equal(samples.length, DUEL.duration / DUEL.step + 1);
  assert.equal(scores.fixed.peakDuty, 50);
  assert.ok(scores.hold.mae < scores.fixed.mae && scores.hold.min > scores.fixed.min);
  assert.ok(scores.fixed.min >= 500 && scores.hold.max > DUEL.rpm && scores.hold.max <= 2500);
  assert.ok(Math.abs(loadEnd.hold.rpm - (level === 65 ? 1800 : 1500)) < 12);
  assert.ok(Math.abs(samples.at(-1).hold.rpm - DUEL.rpm) < 12);
}
const baseline = simulateDuel(65);
const tuned = simulateDuel(65, PI_PROFILES.smooth);
const quick = simulateDuel(65, PI_PROFILES.quick);
assert.ok(tuned.scores.hold.max < baseline.scores.hold.max);
assert.ok(quick.scores.hold.settle < baseline.scores.hold.settle);
const csv = duelCsv(65, PI_PROFILES.smooth, tuned, baseline).trimEnd().split('\r\n');
assert.equal(csv.length, tuned.samples.length + 1);
assert.ok(csv[81].startsWith('2.000,0,1800,0.11,0.12,'));
assert.ok(csv[82].startsWith('2.025,65,1800,0.11,0.12,'));

const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const { count, svg } = buildFigure();
assert.ok(count >= 80 && count <= 150, `Expected an Anatomy Hero, got ${count} solid parts`);
const light = process.argv.includes('--light');
const duelModel = read('duel-model.mjs').replace(/^import [^\n]+\n/, '').replaceAll('export ', '');
const script = read('model.mjs').replaceAll('export ', '') + '\n' + duelModel
  + '\nconst geometry = ' + JSON.stringify(geometry) + ';\n' + read('live.js') + '\n' + read('duel-live.js');
const duelArt = buildDuelMotor();
const html = read('page.html')
  .replace('%%THEME%%', light ? 'light' : 'dark')
  .replace('%%STYLES%%', () => [ISO_CSS, read('style.css'), read('duel.css')].join('\n'))
  .replace('%%FIGURE%%', () => svg)
  .replace('%%TEARDOWN%%', () => buildTeardown())
  .replace('%%DUEL%%', () => read('duel.html').replaceAll('%%DUELMOTOR%%', () => duelArt))
  .replace('%%TRACE%%', () => waveform(SIGNAL.duty, 220, 12, 59))
  .replace('%%SCRIPT%%', () => script)
  .replace('%%LICENSE%%', () => read('ANATOMY-LICENSE.txt').trim());
const output = process.argv.includes('--dist') ? 'dist/' : './';
if (output === 'dist/') mkdirSync(new URL(output, import.meta.url), { recursive: true });
writeFileSync(new URL(output + (light ? 'index-light.html' : 'index.html'), import.meta.url), html);
console.log(`PWM Motor Bench built with ${count} solid parts. Model checks passed.`);
