import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateManeuveringAcceleration,
  getConventionalFlightSpeedLimit,
  getConventionalSpeedLimit,
  integrateWorldVelocity,
  projectRadialVelocity,
  SPEED_OF_LIGHT_MPS
} from './maneuveringThrusterSystem.js';

test('conventional speed envelope is fast in open space and controlled near terrain', () => {
  assert.equal(getConventionalSpeedLimit(500000), 12000);
  assert.equal(getConventionalSpeedLimit(50000), 300);
  assert.equal(getConventionalSpeedLimit(500), 12);
  assert.equal(getConventionalSpeedLimit(20), 4);
});

test('powered upward flight can exceed the low-altitude approach speed limit', () => {
  assert.equal(getConventionalFlightSpeedLimit(20), 4);
  assert.equal(getConventionalFlightSpeedLimit(20, {
    throttle: true,
    climbAlignment: 0.9
  }), 12000);
  assert.equal(getConventionalFlightSpeedLimit(20, {
    throttle: true,
    climbAlignment: 0.1
  }), 12000);
  assert.equal(getConventionalFlightSpeedLimit(20, {
    throttle: true,
    climbAlignment: 0.02
  }), 4);
  assert.equal(getConventionalFlightSpeedLimit(20, {
    verticalSpeed: 25
  }), 12000);
});

test('maneuvering assist damps descent without cancelling planetary gravity', () => {
  const acceleration = calculateManeuveringAcceleration({
    gravityAcceleration: [0, -9.80665, 0],
    radialUp: [0, 1, 0],
    altitudeMeters: 1000,
    radialVelocity: -4
  });
  assert.ok(Math.abs(acceleration[1] - 10) < 1e-9);
});

test('manual maneuver input applies lateral and vertical thrust', () => {
  const acceleration = calculateManeuveringAcceleration({
    gravityAcceleration: [0, -9.80665, 0],
    radialUp: [0, 1, 0],
    shipRight: [1, 0, 0],
    altitudeMeters: 50000,
    lateralInput: -1,
    verticalInput: 1
  });
  assert.deepEqual(acceleration, [-14, 32, 0]);
});

test('world velocity integration is bounded and uses SI seconds', () => {
  assert.deepEqual(integrateWorldVelocity([0, 0, 0], [0, -9.80665, 0], 1), [0, -9.80665, 0]);
  assert.ok(Math.abs(Math.hypot(...integrateWorldVelocity([0, 0, 0], [SPEED_OF_LIGHT_MPS, 0, 0], 1)) - 1200) < 1e-9);
  assert.ok(Math.abs(Math.hypot(...integrateWorldVelocity([465, 0, 0], [0, 0, 0], 1, 0)) - 465) < 1e-9);
  assert.equal(projectRadialVelocity([0, -3, 0], [0, 1, 0]), -3);
});
