import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLandingActuationAcceleration } from './landingAutopilotActuation.js';

test('landing actuation converts north/east/up acceleration into world coordinates', () => {
  const result = calculateLandingActuationAcceleration({
    desiredVelocityMetersPerSecond: [2, -1, 0],
    currentVelocityMetersPerSecond: [0, 0, 0],
    platformWorldQuaternion: [0, 0, 0, 1]
  });
  assert.deepEqual(result, [4.8, -2.4, 0]);
});

test('landing actuation rotates local north through the platform frame', () => {
  const half = Math.sqrt(0.5);
  const result = calculateLandingActuationAcceleration({
    desiredVelocityMetersPerSecond: [0, 0, 1],
    currentVelocityMetersPerSecond: [0, 0, 0],
    platformWorldQuaternion: [0, half, 0, half]
  });
  assert.ok(Math.abs(result[0] + 2.4) < 1e-9);
  assert.ok(Math.abs(result[1]) < 1e-9);
  assert.ok(Math.abs(result[2]) < 1e-9);
});

test('landing actuation clamps acceleration and rejects invalid telemetry', () => {
  const result = calculateLandingActuationAcceleration({
    desiredVelocityMetersPerSecond: [100, 0, 0],
    currentVelocityMetersPerSecond: [0, 0, 0],
    platformWorldQuaternion: [0, 0, 0, 1],
    maximumAcceleration: 12
  });
  assert.ok(Math.abs(Math.hypot(...result) - 12) < 1e-9);
  assert.equal(calculateLandingActuationAcceleration({}), null);
});
