# PWM Motor Bench

PWM Motor Bench is an interactive browser simulator for a brushed DC motor. It connects PWM duty and load to a virtual oscilloscope, a tachometer, and an isometric motor that you can take apart.

- **Motor Bench** shows how PWM and load affect speed. Turn on Tahan RPM to compare manual duty with closed-loop control.
- **Duel Dyno** applies the same ten-second load sequence to two identical simulated motors. It compares fixed duty with PI control.
- **Pit Tuning** lets you adjust P and I, compare the result with the default controller, and export all 401 samples as CSV.

## Run locally

Use Node.js 20.10 or later. Run `node build.mjs --audit` and open the generated `index.html`. The app runs offline and has no runtime dependencies. Run `node build.mjs --dist` to produce the static deployment directory.

The simulation uses an illustrative first-order motor model, a 12 V PWM input at 1 kHz, and a speed-dependent load. The figures show simulated behavior and do not establish real hardware performance. See [the model notes](README.txt) for assumptions and references.

The vendored [Anatomy](https://github.com/wheresryan22/anatomy) kit is distributed under its [MIT license](ANATOMY-LICENSE.txt).
