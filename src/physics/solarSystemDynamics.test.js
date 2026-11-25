import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASTRONOMICAL_UNIT_METERS,
  GRAVITATIONAL_CONSTANT_M3_KG_S2,
  createSolarSystemDynamics
} from './solarSystemDynamics.js';

const close = (actual, expected, tolerance) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);

test('default solar system exposes Sun, Earth and Moon in SI units', () => {
  const dynamics = createSolarSystemDynamics();
  const snapshot = dynamics.getSnapshot();
  assert.deepEqual(snapshot.bodies.map(body => body.id), ['sun', 'earth', 'moon']);
  close(dynamics.getBodyState('earth').positionMeters[0], ASTRONOMICAL_UNIT_METERS, 1);
  assert.ok(dynamics.getBodyState('earth').velocityMetersPerSecond[2] > 29_000);
});

test('two-body gravity conserves the expected direction and accelerates toward the source', () => {
  const dynamics = createSolarSystemDynamics({
    bodies: [
      { id: 'primary', massKg: 1e20, positionMeters: [0, 0, 0], velocityMetersPerSecond: [0, 0, 0] },
      { id: 'probe', massKg: 1e10, positionMeters: [1000, 0, 0], velocityMetersPerSecond: [0, 0, 0] }
    ],
    maxSubstepSeconds: 0.01
  });
  dynamics.advance(0.1);
  const probe = dynamics.getBodyState('probe');
  assert.ok(probe.velocityMetersPerSecond[0] < 0);
  assert.equal(probe.velocityMetersPerSecond[1], 0);
  assert.equal(probe.velocityMetersPerSecond[2], 0);
});

test('N-body acceleration delegates to the shared C++ gravity kernel when available', () => {
  let calls = 0;
  const kernel = {
    backend: 'wasm-c++',
    acceleration({ position, bodies }) {
      calls += 1;
      assert.equal(position.length, 3);
      assert.ok(bodies.length >= 1);
      return [0, 0, 0];
    }
  };
  const dynamics = createSolarSystemDynamics({ gravityKernel: kernel });
  dynamics.advance(0.01);
  assert.equal(dynamics.gravityBackend, 'wasm-c++');
  assert.ok(calls >= 6);
});

test('simulation clock supports pause and adjustable time scale', () => {
  const dynamics = createSolarSystemDynamics({ timeScale: 10 });
  dynamics.advance(2);
  close(dynamics.simulationTimeSeconds, 20, 1e-8);
  dynamics.setPaused(true);
  dynamics.advance(5);
  close(dynamics.simulationTimeSeconds, 20, 1e-8);
  dynamics.setPaused(false);
  dynamics.setTimeScale(0.5);
  dynamics.advance(2);
  close(dynamics.simulationTimeSeconds, 21, 1e-8);
});

test('local reference frame inherits orbital velocity and rotational tangential velocity', () => {
  const dynamics = createSolarSystemDynamics({
    bodies: [{
      id: 'planet',
      massKg: 5e24,
      positionMeters: [100, 200, 300],
      velocityMetersPerSecond: [10, 20, 30],
      rotationAxis: [0, 1, 0],
      angularVelocityRadPerSecond: 2
    }]
  });
  const frame = dynamics.getReferenceFrameState('planet', [5, 0, 0]);
  assert.deepEqual(frame.worldPositionMeters, [105, 200, 300]);
  assert.deepEqual(frame.worldVelocityMetersPerSecond, [10, 20, 20]);
});

test('invalid time scales and malformed bodies are rejected', () => {
  const dynamics = createSolarSystemDynamics();
  assert.throws(() => dynamics.setTimeScale(-1), RangeError);
  assert.throws(() => createSolarSystemDynamics({ bodies: [{ id: 'bad', massKg: -1 }] }), TypeError);
  assert.ok(GRAVITATIONAL_CONSTANT_M3_KG_S2 > 0);
});
