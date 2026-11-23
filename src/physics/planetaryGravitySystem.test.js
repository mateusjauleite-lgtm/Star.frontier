import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlanetaryGravitySystem,
  EARTH_GRAVITATIONAL_PARAMETER_M3_S2,
  EARTH_SIDEREAL_ROTATION_RAD_S,
  EARTH_AXIAL_TILT_DEGREES
} from './planetaryGravitySystem.js';

test('Earth gravity is continuous and follows inverse-square falloff without an altitude cutoff', () => {
  const gravity = createPlanetaryGravitySystem();
  const surface = gravity.accelerationAt([6_371_008.8, 0, 0]);
  const highOrbit = gravity.accelerationAt([6_371_008.8 + 250_000, 0, 0]);
  const farOrbit = gravity.accelerationAt([6_371_008.8 + 1_000_000, 0, 0]);
  assert.ok(Math.abs(Math.hypot(...surface) - 9.82025) < 0.02);
  assert.ok(Math.hypot(...highOrbit) > Math.hypot(...farOrbit));
  assert.ok(Math.hypot(...farOrbit) > 0);
});

test('Earth gravity points toward the planet and can use the shared gravity kernel', () => {
  const calls = [];
  const gravity = createPlanetaryGravitySystem({
    getEarthCenter: () => [10, 0, 0],
    gravityKernel: {
      acceleration(input) {
        calls.push(input);
        return [-2, 0, 0];
      }
    }
  });
  assert.deepEqual(gravity.accelerationAt([20, 0, 0]), [-2, 0, 0]);
  assert.deepEqual(calls[0].bodies, [{
    position: [10, 0, 0],
    mu: EARTH_GRAVITATIONAL_PARAMETER_M3_S2
  }]);
});

test('circular orbital velocity is tangent to the Earth-centred radius', () => {
  const gravity = createPlanetaryGravitySystem({
    getEarthCenter: () => [0, 0, 0],
    getEarthSpinAxis: () => [0, 1, 0]
  });
  const position = [7_000_000, 0, 0];
  const velocity = gravity.circularOrbitVelocity(position);
  assert.ok(Math.abs(position.reduce((sum, value, axis) => sum + value * velocity[axis], 0)) < 1e-6);
  assert.ok(Math.abs(Math.hypot(...velocity) - Math.sqrt(EARTH_GRAVITATIONAL_PARAMETER_M3_S2 / 7_000_000)) < 1e-9);
});

test('velocity-Verlet integration advances a body under the same Earth field', () => {
  const gravity = createPlanetaryGravitySystem();
  const position = [7_000_000, 0, 0];
  const velocity = gravity.circularOrbitVelocity(position);
  const next = gravity.integrate(position, velocity, 1);
  assert.ok(next);
  assert.notDeepEqual(next.position, position);
  assert.ok(next.velocity.every(Number.isFinite));
});

test('Earth spin and axial tilt use sidereal physical reference values', () => {
  assert.ok(Math.abs(EARTH_SIDEREAL_ROTATION_RAD_S - 7.2921150e-5) < 1e-12);
  assert.ok(Math.abs(EARTH_AXIAL_TILT_DEGREES - 23.439281) < 1e-6);
});

test('surface launch inherits the velocity created by Earth rotation', () => {
  const gravity = createPlanetaryGravitySystem({
    getEarthCenter: () => [0, 0, 0],
    getEarthSpinAxis: () => [0, 1, 0]
  });
  const velocity = gravity.surfaceVelocityAt([6_378_137, 0, 0]);
  assert.ok(Math.abs(Math.hypot(...velocity) - 465.1) < 0.2);
  assert.ok(Math.abs(velocity[0]) < 1e-9);
  assert.ok(Math.abs(velocity[1]) < 1e-9);
});
