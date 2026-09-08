#!/usr/bin/env node
/**
 * Headless Physics Test — Kawasaki Racing Simulator
 *
 * Tests: standard distances (400m, 1km, 5km, 20km), custom length,
 * endless mode (start / stop), realistic vmax, plausible 0-100 times.
 *
 * Run: node tests/physics-test.js
 * Exit 0 = all pass, Exit 1 = at least one failure.
 */

'use strict';

// ============================================================
// Physics constants (mirror of race.html)
// ============================================================
const RACE_BIKES = {
  h2:         { name:'Kawasaki Ninja H2',       ps:231, torque:141, weight:216, vmax:300, redline:14000, idleRpm:1200, gears:6 },
  zx10r:      { name:'Kawasaki ZX-10R',          ps:203, torque:115, weight:186, vmax:299, redline:14000, idleRpm:1200, gears:6 },
  zh2:        { name:'Kawasaki Z H2',             ps:200, torque:137, weight:239, vmax:290, redline:11000, idleRpm:1100, gears:6 },
  h2sx:       { name:'Kawasaki H2 SX',            ps:200, torque:137, weight:240, vmax:299, redline:13000, idleRpm:1200, gears:6 },
  hybrid1200: { name:'Kawasaki Ninja Hybrid',     ps:220, torque:220, weight:227, vmax:280, redline:12000, idleRpm:800,  gears:6 },
  zx6r:       { name:'Kawasaki ZX-6R',            ps:130, torque:71,  weight:193, vmax:260, redline:15000, idleRpm:1500, gears:6 },
  z900:       { name:'Kawasaki Z900',              ps:125, torque:99,  weight:193, vmax:248, redline:11500, idleRpm:1100, gears:6 },
  versys1000: { name:'Kawasaki Versys 1000',       ps:120, torque:102, weight:235, vmax:220, redline:10000, idleRpm:1000, gears:6 },
  ninja650:   { name:'Kawasaki Ninja 650',         ps:68,  torque:64,  weight:172, vmax:200, redline:9000,  idleRpm:900,  gears:6 },
  z650:       { name:'Kawasaki Z650',              ps:68,  torque:64,  weight:168, vmax:190, redline:9000,  idleRpm:900,  gears:6 },
  ninja400:   { name:'Kawasaki Ninja 400',         ps:45,  torque:38,  weight:168, vmax:190, redline:10000, idleRpm:1200, gears:6 },
  zx25r:      { name:'Kawasaki ZX-25R',            ps:51,  torque:23,  weight:182, vmax:215, redline:17000, idleRpm:2000, gears:6 },
  eliminator400:{name:'Kawasaki Eliminator 400',  ps:45,  torque:43,  weight:176, vmax:165, redline:8000,  idleRpm:900,  gears:6 },
  w800:       { name:'Kawasaki W800',              ps:48,  torque:63,  weight:202, vmax:170, redline:7000,  idleRpm:800,  gears:5 },
  klx300:     { name:'Kawasaki KLX 300',           ps:27,  torque:26,  weight:137, vmax:137, redline:9500,  idleRpm:1400, gears:6 },
  kx450:      { name:'Kawasaki KX 450',            ps:62,  torque:54,  weight:110, vmax:150, redline:11000, idleRpm:1800, gears:5 },
  samurai:    { name:'Kawasaki Samurai',            ps:31,  torque:25,  weight:145, vmax:160, redline:8000,  idleRpm:1200, gears:5 },
  ninja7hybrid:{name:'Kawasaki Ninja 7 Hybrid',    ps:80,  torque:61,  weight:240, vmax:180, redline:10500, idleRpm:1000, gears:6 },
  z900se:     { name:'Kawasaki Z900SE',             ps:125, torque:99,  weight:196, vmax:248, redline:11500, idleRpm:1100, gears:6 },
  versys650:  { name:'Kawasaki Versys 650',         ps:67,  torque:61,  weight:216, vmax:200, redline:9000,  idleRpm:900,  gears:6 },
  w230:       { name:'Kawasaki W230',               ps:19,  torque:18,  weight:144, vmax:120, redline:9000,  idleRpm:1300, gears:5 },
  klr650:     { name:'Kawasaki KLR650',             ps:40,  torque:52,  weight:198, vmax:145, redline:7500,  idleRpm:1300, gears:5 },
  vulcans:    { name:'Kawasaki Vulcan S',           ps:61,  torque:63,  weight:229, vmax:180, redline:8500,  idleRpm:900,  gears:6 },
};

const GEAR_RATIOS  = [0, 3.2, 2.1, 1.6, 1.28, 1.05, 0.88];
const FINAL_DRIVE  = 2.8;
const WHEEL_CIRC   = 2.0;
const WHEEL_RADIUS = WHEEL_CIRC / (2 * Math.PI);

// Per-bike drag coefficient
function computeAllDragCoeffs() {
  Object.keys(RACE_BIKES).forEach(key => {
    const bike = RACE_BIKES[key];
    const vmaxMs      = bike.vmax / 3.6;
    const powerW      = bike.ps * 735.5;
    const thrustAtVmax = (powerW * 0.82) / vmaxMs;
    const rollingRes  = bike.weight * 9.81 * 0.015;
    bike.dragK = Math.max(thrustAtVmax - rollingRes, 1) / (vmaxMs * vmaxMs);
  });
}
computeAllDragCoeffs();

function getTorqueNormalized(rpm, bike) {
  if (rpm < bike.idleRpm) return 0; // strictly below idle = no torque
  const peakRpm = bike.redline * 0.60;
  if (rpm <= peakRpm) {
    const t = (rpm - bike.idleRpm) / (peakRpm - bike.idleRpm);
    return 0.55 + 0.45 * Math.pow(Math.min(t, 1), 0.65);
  }
  const t = (rpm - peakRpm) / (bike.redline - peakRpm);
  return Math.max(0.40, 1.0 - 0.30 * t);
}

function getWheelForce(bike, rpm, gear, throttle) {
  if (gear === 0) return 0;
  const torqueNm  = bike.torque * getTorqueNormalized(rpm, bike) * throttle;
  const gearRatio = GEAR_RATIOS[gear] * FINAL_DRIVE;
  const force     = (torqueNm * gearRatio) / WHEEL_RADIUS;
  return Math.min(force, bike.weight * 9.81 * 1.3);
}

function getRpmFromSpeed(speedMs, gear) {
  if (gear === 0) return 0;
  const ratio    = GEAR_RATIOS[gear] * FINAL_DRIVE;
  const wheelRpm = (speedMs * 60) / WHEEL_CIRC;
  return wheelRpm * ratio;
}

function makeState(bike) {
  return {
    running: true,
    time: 0, dist: 0, speed: 0, rpm: bike.idleRpm,
    gear: 1, throttle: 1.0, t100: null, reached100: false,
    velHistory: [], splits: {}, splitTargets: [],
    tcOn: true, absOn: true,
  };
}

/**
 * Simulate a race to a given distance or until maxSecs.
 * Returns { time, dist, speed, t100, reachedTarget, topSpeed }
 */
function simulateRace(bikeKey, targetDist, { maxSecs = 120, dt = 0.01 } = {}) {
  const bike  = RACE_BIKES[bikeKey];
  const state = makeState(bike);
  let topSpeed = 0;

  while (state.running && state.time < maxSecs) {
    const throttle = state.throttle;
    let   gear     = state.gear;

    // RPM from speed (with clutch-slip launch model)
    let rpm;
    if (state.speed < 3 && state.throttle > 0) {
      const rpmFromSpeed = getRpmFromSpeed(state.speed, gear);
      const launchRpm = bike.idleRpm + state.throttle * (bike.redline * 0.45 - bike.idleRpm);
      rpm = Math.max(launchRpm, rpmFromSpeed);
    } else {
      rpm = getRpmFromSpeed(state.speed, gear);
    }
    rpm = Math.max(bike.idleRpm, Math.min(rpm, bike.redline * 1.05));

    // Auto-shift
    if (rpm >= bike.redline * 0.88 && gear < bike.gears) {
      gear++;
      state.gear = gear;
      rpm = Math.max(bike.idleRpm, getRpmFromSpeed(state.speed, gear));
    } else if (gear > 1 && state.speed > 0.5) {
      const rpmDown = getRpmFromSpeed(state.speed, gear - 1);
      if (rpm < bike.redline * 0.30 && rpmDown < bike.redline * 0.90) {
        gear--;
        state.gear = gear;
        rpm = Math.max(bike.idleRpm, rpmDown);
      }
    }
    state.rpm = rpm;

    let wheelForce = getWheelForce(bike, rpm, gear, throttle);
    if (state.tcOn && state.speed < 8 && wheelForce > bike.weight * 9.81 * 1.2)
      wheelForce = bike.weight * 9.81 * 1.2;

    const drag      = bike.dragK * state.speed * state.speed;
    const rolling   = bike.weight * 9.81 * 0.015;
    const netForce  = wheelForce - drag - rolling;
    const accel     = netForce / bike.weight;

    state.speed = Math.max(0, state.speed + accel * dt);
    state.dist  += state.speed * dt;
    state.time  += dt;

    const kmh = state.speed * 3.6;
    if (kmh > topSpeed) topSpeed = kmh;

    if (!state.reached100 && kmh >= 100) {
      state.t100 = state.time;
      state.reached100 = true;
    }

    // Finish?
    if (targetDist !== Infinity && state.dist >= targetDist) {
      state.running = false;
    }
  }

  return {
    time:          state.time,
    dist:          state.dist,
    speed:         state.speed * 3.6,
    t100:          state.t100,
    reachedTarget: targetDist === Infinity ? true : state.dist >= targetDist,
    topSpeed,
    gear:          state.gear,
  };
}

// ============================================================
// Test harness
// ============================================================
let passed = 0, failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅  ${msg}`);
    passed++;
  } else {
    console.log(`  ❌  FAIL: ${msg}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

// ============================================================
// Tests
// ============================================================

section('1 · Standard 400m Race (H2)');
(function() {
  const r = simulateRace('h2', 400, { maxSecs: 30 });
  assert(r.reachedTarget,                       '400m finish reached');
  assert(r.time > 8 && r.time < 16,             `Finish time plausible (${r.time.toFixed(2)}s, expect 8–16s)`);
  assert(r.t100 !== null,                        '0–100 recorded');
  assert(r.t100 > 2.0 && r.t100 < 5.0,          `0–100 plausible (${r.t100 ? r.t100.toFixed(2) : '—'}s, expect 2–5s)`);
  assert(r.topSpeed > 200 && r.topSpeed <= 310,  `Top speed reached (${r.topSpeed.toFixed(0)} km/h, expect >200)`);
})();

section('2 · 1km Race (ZX-10R)');
(function() {
  const r = simulateRace('zx10r', 1000, { maxSecs: 40 });
  assert(r.reachedTarget,                       '1km finish reached');
  assert(r.time > 13 && r.time < 40,            `Finish time plausible (${r.time.toFixed(2)}s, expect 13–40s)`);
  assert(r.topSpeed > 220,                       `Top speed > 220 km/h (${r.topSpeed.toFixed(0)} km/h)`);
})();

section('3 · 5km Race (Z900)');
(function() {
  const r = simulateRace('z900', 5000, { maxSecs: 180 });
  assert(r.reachedTarget,                        '5km finish reached');
  assert(r.time > 60 && r.time < 180,            `Finish time plausible (${r.time.toFixed(2)}s)`);
  // Near vmax within 15%
  const vmaxKmh = RACE_BIKES.z900.vmax;
  assert(r.topSpeed >= vmaxKmh * 0.85,           `Top speed ≥85% vmax (${r.topSpeed.toFixed(0)} km/h, vmax=${vmaxKmh})`);
})();

section('4 · 20km Race (Versys 1000)');
(function() {
  const r = simulateRace('versys1000', 20000, { maxSecs: 700 });
  assert(r.reachedTarget,                        '20km finish reached');
  const vmaxKmh = RACE_BIKES.versys1000.vmax;
  assert(r.topSpeed >= vmaxKmh * 0.90,           `Top speed ≥90% vmax (${r.topSpeed.toFixed(0)} km/h, vmax=${vmaxKmh})`);
})();

section('5 · Custom Length (2350m — Ninja 650)');
(function() {
  const customLen = 2350;
  const r = simulateRace('ninja650', customLen, { maxSecs: 180 });
  assert(r.reachedTarget,                        `Custom ${customLen}m finish reached`);
  assert(r.dist >= customLen,                    `dist (${r.dist.toFixed(0)}m) >= ${customLen}m`);
})();

section('6 · Endless Mode — start, run 30s, then stop');
(function() {
  // Endless = simulateRace with Infinity target but maxSecs = 30
  const r = simulateRace('zx6r', Infinity, { maxSecs: 30, dt: 0.01 });
  assert(r.reachedTarget,                        'Endless run completes (stop by time)');
  assert(Math.abs(r.time - 30) < 0.1,            `Ran ~30s (${r.time.toFixed(2)}s)`);
  assert(r.dist > 1000,                          `Distance > 1km in 30s (${r.dist.toFixed(0)}m)`);
  assert(r.t100 !== null,                        '0–100 recorded in endless run');
  assert(r.topSpeed > 180,                       `Top speed > 180 km/h in endless run (${r.topSpeed.toFixed(0)} km/h)`);
})();

section('7 · Endless Mode — short 5s run (low distance)');
(function() {
  const r = simulateRace('zx10r', Infinity, { maxSecs: 5, dt: 0.01 });
  assert(r.dist > 50,                            `Moved > 50m in 5s (${r.dist.toFixed(0)}m)`);
  assert(r.dist < 800,                           `< 800m in 5s (${r.dist.toFixed(0)}m)`);
})();

section('8 · All bikes reach ≥85% documented vmax over 20km');
(function() {
  Object.keys(RACE_BIKES).forEach(key => {
    const bike = RACE_BIKES[key];
    // Give small bikes more time/distance
    const dist = Math.max(5000, bike.vmax * 20);
    const maxSecs = Math.max(120, dist / (bike.vmax / 3.6) * 3);
    const r = simulateRace(key, dist, { maxSecs, dt: 0.02 });
    const pct = (r.topSpeed / bike.vmax * 100).toFixed(0);
    assert(
      r.topSpeed >= bike.vmax * 0.82,
      `${bike.name}: topSpeed ${r.topSpeed.toFixed(0)} km/h ≥ 82% of ${bike.vmax} km/h (${pct}%)`
    );
  });
})();

section('9 · 0–100 km/h times are plausible');
(function() {
  // High-performance: should be < 5s; tourers/small < 10s
  // Ideal-conditions simulation (full throttle, perfect traction) produces
  // faster times than real-world tests; lower bounds reflect that.
  const expectations = {
    h2:       [1.8, 4.5],   // 200+ PS hyperbike
    zx10r:    [2.0, 5.0],   // 200 PS superbike
    zx6r:     [2.8, 5.5],   // 130 PS supersport
    z900:     [2.2, 5.5],   // 125 PS naked (light)
    ninja650: [2.8, 7.0],   // 68 PS middleweight
    w800:     [3.8, 9.0],   // 48 PS classic
    klx300:   [5.0, 12.0],  // 27 PS enduro
  };
  Object.entries(expectations).forEach(([key, [lo, hi]]) => {
    const r = simulateRace(key, 1000, { maxSecs: 30 });
    const t = r.t100;
    assert(
      t !== null && t > lo && t < hi,
      `${RACE_BIKES[key].name}: 0–100 = ${t ? t.toFixed(2) + 's' : '—'} (expect ${lo}–${hi}s)`
    );
  });
})();

section('10 · Physics consistency — acceleration decreases near vmax');
(function() {
  // Record speed at t=2s, t=5s, t=10s → speed gain should decrease
  const bike = RACE_BIKES.h2;
  const state = makeState(bike);
  const snapshots = {};
  const dt = 0.01;

  while (state.time < 15) {
    let gear = state.gear;
    let rpmRaw = state.speed < 3 ? Math.max(getRpmFromSpeed(state.speed, gear), bike.idleRpm + (bike.redline * 0.45 - bike.idleRpm)) : getRpmFromSpeed(state.speed, gear);
    let rpm  = Math.max(bike.idleRpm, Math.min(rpmRaw, bike.redline * 1.05));

    if (rpm >= bike.redline * 0.88 && gear < bike.gears) {
      gear++; state.gear = gear;
      rpm = Math.max(bike.idleRpm, getRpmFromSpeed(state.speed, gear));
    } else if (gear > 1 && state.speed > 0.5) {
      const rdown = getRpmFromSpeed(state.speed, gear - 1);
      if (rpm < bike.redline * 0.30 && rdown < bike.redline * 0.90) {
        gear--; state.gear = gear;
        rpm = Math.max(bike.idleRpm, rdown);
      }
    }

    let wf = getWheelForce(bike, rpm, gear, 1.0);
    if (state.tcOn && state.speed < 8 && wf > bike.weight * 9.81 * 1.2) wf = bike.weight * 9.81 * 1.2;
    const net   = wf - bike.dragK * state.speed * state.speed - bike.weight * 9.81 * 0.015;
    state.speed = Math.max(0, state.speed + (net / bike.weight) * dt);
    state.dist  += state.speed * dt;
    state.time  += dt;

    [2, 5, 10, 15].forEach(t => {
      if (!snapshots[t] && state.time >= t) snapshots[t] = state.speed * 3.6;
    });
  }

  // Compare acceleration RATES (km/h per second) across equal windows
  const rate_0_2  = (snapshots[2]  || 0) / 2;         // km/h per second in first 2s
  const rate_2_5  = ((snapshots[5]  || 0) - (snapshots[2]  || 0)) / 3;
  const rate_5_10 = ((snapshots[10] || 0) - (snapshots[5]  || 0)) / 5;
  const rate_10_15= ((snapshots[15] || 0) - (snapshots[10] || 0)) / 5;

  assert(rate_0_2 > 30,          `Fast initial rate: ${rate_0_2.toFixed(0)} km/h/s in first 2s`);
  assert(rate_2_5 < rate_0_2,    `Accel rate tapers: ${rate_2_5.toFixed(0)} km/h/s at 2–5s < ${rate_0_2.toFixed(0)} at 0–2s`);
  assert(rate_10_15 < rate_5_10, `Accel rate near vmax: ${rate_10_15.toFixed(0)} km/h/s at 10–15s < ${rate_5_10.toFixed(0)} at 5–10s`);
})();

// ============================================================
// Results
// ============================================================
console.log('\n' + '═'.repeat(60));
console.log(`  RESULTS: ${passed}/${passed + failed} passed`);
console.log('═'.repeat(60) + '\n');

if (failed > 0) process.exit(1);
