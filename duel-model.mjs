import { MOTOR, PI_DEFAULT, advance, controlSpeed, measure, startHold } from './model.mjs';

export const DUEL = { rpm: 1800, duty: 50, step: .025, onset: 2, release: 6, duration: 10 };
export const PI_PROFILES = {
  default: PI_DEFAULT,
  smooth: { kp: .11, ki: .12 },
  quick: { kp: .055, ki: .15 },
};

export function duelLoad(time, load) {
  return time >= DUEL.onset && time < DUEL.release ? load : 0;
}

export function simulateDuel(load, gains = PI_DEFAULT) {
  const tracks = {
    fixed: { rpm: DUEL.rpm, duty: DUEL.duty, angle: 0, min: DUEL.rpm, max: DUEL.rpm, error: 0, peakDuty: DUEL.duty },
    hold: { rpm: DUEL.rpm, duty: DUEL.duty, angle: 0, min: DUEL.rpm, max: DUEL.rpm, error: 0, peakDuty: DUEL.duty },
  };
  let integral = startHold(DUEL.rpm, DUEL.rpm, DUEL.duty, gains);
  const snapshot = () => ({ fixed: { ...tracks.fixed }, hold: { ...tracks.hold } });
  const samples = [snapshot()];
  const count = DUEL.duration / DUEL.step;
  for (let i = 0; i < count; i++) {
    const resistance = duelLoad(i * DUEL.step, load);
    const command = controlSpeed(DUEL.rpm, tracks.hold.rpm, integral, DUEL.step, gains);
    tracks.hold.duty = command.duty;
    integral = command.integral;
    for (const lane of Object.values(tracks)) {
      const previous = lane.rpm;
      const { target, tau } = measure(lane.duty, resistance);
      lane.rpm = advance(previous, target, tau, DUEL.step);
      lane.angle += (previous + lane.rpm) / 2 * 6 * DUEL.step / MOTOR.visualReduction;
      lane.error += Math.abs(DUEL.rpm - lane.rpm) * DUEL.step;
      lane.min = Math.min(lane.min, lane.rpm);
      lane.max = Math.max(lane.max, lane.rpm);
      lane.peakDuty = Math.max(lane.peakDuty, lane.duty);
    }
    samples.push(snapshot());
  }
  const releaseIndex = Math.round(DUEL.release / DUEL.step);
  const scores = Object.fromEntries(Object.entries(tracks).map(([name, lane]) => {
    const lastOutside = samples.findLastIndex((sample, i) =>
      i >= releaseIndex && Math.abs(DUEL.rpm - sample[name].rpm) > DUEL.rpm * .02,
    );
    const settle = lastOutside < releaseIndex ? 0
      : lastOutside === count ? null : (lastOutside + 1 - releaseIndex) * DUEL.step;
    return [name, { min: lane.min, max: lane.max, mae: lane.error / DUEL.duration, peakDuty: lane.peakDuty, settle }];
  }));
  return { samples, scores };
}

export function duelCsv(load, gains, race, baseline) {
  const header = 'time_s,load_percent,target_rpm,kp,ki,duty_fixed_percent,rpm_fixed,duty_tuned_percent,rpm_tuned,duty_baseline_percent,rpm_baseline';
  const rows = race.samples.map((sample, index) => {
    const reference = baseline.samples[index].hold;
    return [
      (index * DUEL.step).toFixed(3), duelLoad(Math.max(0, index - 1) * DUEL.step, load), DUEL.rpm, gains.kp, gains.ki,
      sample.fixed.duty, sample.fixed.rpm.toFixed(2), sample.hold.duty, sample.hold.rpm.toFixed(2), reference.duty, reference.rpm.toFixed(2),
    ].join(',');
  });
  return [header, ...rows, ''].join('\r\n');
}
