export const SIGNAL = { frequency: 1000, high: 12, duty: 62, load: 20 };
export const MOTOR = { freeRpm: 3600, tau: 0.62, drag: 1.4, visualReduction: 18 };
export const SPEED_HOLD = { initial: 1800, minimum: 600, maximum: 2800 };
export const PI_DEFAULT = { kp: 0.035, ki: 0.095 };

export function measure(duty, load) {
  const period = 1e6 / SIGNAL.frequency;
  const highTime = period * duty / 100;
  const drag = 1 + MOTOR.drag * load / 100;
  return {
    period,
    highTime,
    lowTime: period - highTime,
    average: SIGNAL.high * duty / 100,
    target: MOTOR.freeRpm * duty / 100 / drag,
    tau: MOTOR.tau / drag,
  };
}

export function advance(rpm, target, tau, seconds) {
  return target + (rpm - target) * Math.exp(-seconds / tau);
}

function proportionalDuty(target, rpm, kp) {
  return 100 * target / MOTOR.freeRpm + kp * (target - rpm);
}

export function startHold(target, rpm, duty, gains = PI_DEFAULT) {
  return duty - proportionalDuty(target, rpm, gains.kp);
}

export function controlSpeed(target, rpm, integral, seconds, gains = PI_DEFAULT) {
  const error = target - rpm;
  const bias = proportionalDuty(target, rpm, gains.kp);
  const next = integral + gains.ki * error * seconds;
  const request = bias + next;
  const saturated = (request > 100 && error > 0) || (request < 0 && error < 0);
  const output = Math.min(100, Math.max(0, request));
  return {
    duty: Math.round(output * 10) / 10,
    integral: saturated ? Math.min(100 - bias, Math.max(-bias, integral)) : next,
  };
}

export function waveform(duty, width, top, bottom) {
  if (duty === 0) return `M0 ${bottom}H${width}`;
  if (duty === 100) return `M0 ${top}H${width}`;
  const cycle = width / 2;
  const highWidth = cycle * duty / 100;
  return `M0 ${top}H${highWidth}V${bottom}H${cycle}V${top}H${cycle + highWidth}V${bottom}H${width}`;
}
