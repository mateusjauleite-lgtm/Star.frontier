import test from 'node:test';
import assert from 'node:assert/strict';
import { createEarthOrbitalFrame } from './orbitalFrame.js';

const closeVector = (actual, expected, tolerance = 1e-9) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) <= tolerance,
    `axis ${index}: expected ${expected[index]}, received ${value}`));
};

test('Earth orbital frame converts world positions to Earth-centred SI and back', () => {
  const frame = createEarthOrbitalFrame({
    originWorld: [10, -4, 20],
    metersPerVisualUnit: 10000
  });
  const world = [11, -2, 17];
  closeVector(frame.metersToWorldPosition(frame.worldPositionToMeters(world)), world);
  closeVector(frame.worldPositionToMeters(world), [10000, 20000, -30000]);
});

test('Earth orbital frame applies and reverses its world orientation', () => {
  const halfTurn = [0, Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4)];
  const frame = createEarthOrbitalFrame({
    originWorld: [0, 0, 0],
    orientationWorld: halfTurn,
    metersPerVisualUnit: 1000
  });
  const world = [2, 0, 0];
  closeVector(frame.metersToWorldPosition(frame.worldPositionToMeters(world)), world);
});

test('Earth orbital frame converts vectors without applying the Earth origin', () => {
  const frame = createEarthOrbitalFrame({
    originWorld: [100, 200, 300],
    metersPerVisualUnit: 500
  });
  closeVector(frame.worldVectorToMeters([2, -4, 6]), [1000, -2000, 3000]);
  closeVector(frame.metersVectorToWorld([1000, -2000, 3000]), [2, -4, 6]);
});

test('Earth orbital frame rejects invalid scale and non-finite coordinates', () => {
  assert.throws(() => createEarthOrbitalFrame({ visualUnitsPerKm: 0 }));
  const frame = createEarthOrbitalFrame({ visualUnitsPerKm: 1 });
  assert.equal(frame.worldPositionToMeters([1, NaN, 3]), null);
  assert.equal(frame.metersToWorldPosition([1, 2]), null);
});


test('Earth orbital frame keeps the legacy km scale as a compatibility adapter', () => {
  const frame = createEarthOrbitalFrame({ visualUnitsPerKm: 0.1 });
  assert.equal(frame.metersPerVisualUnit, 10000);
  closeVector(frame.metersToWorldPosition([10000, 0, 0]), [1, 0, 0]);
});
