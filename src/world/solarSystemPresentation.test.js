import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSolarSystemPresentationAdapter } from './solarSystemPresentation.js';

test('presentation adapter converts astronomical positions to an Earth-centred visual frame', () => {
  const adapter = createSolarSystemPresentationAdapter(THREE, { visualUnitsPerMeter: 0.001 });
  const frame = adapter.getFrame({
    simulationTimeSeconds: 12,
    bodies: [
      { id: 'sun', positionMeters: [0, 0, 0] },
      { id: 'earth', positionMeters: [1000, 0, 0], velocityMetersPerSecond: [0, 0, 30], rotationAngleRad: 0.5, rotationAxis: [0, 1, 0] },
      { id: 'moon', positionMeters: [1100, 0, 0] }
    ]
  });
  assert.ok(frame);
  assert.deepEqual(frame.relativePositions.earth.toArray(), [0, 0, 0]);
  assert.deepEqual(frame.relativePositions.moon.toArray(), [0.1, 0, 0]);
  assert.deepEqual(frame.sunDirection.toArray(), [-1, 0, 0]);
  assert.equal(frame.earthRotationAngleRad, 0.5);
});

test('presentation adapter rejects invalid scales and incomplete ephemerides', () => {
  assert.throws(() => createSolarSystemPresentationAdapter(THREE, { visualUnitsPerMeter: 0 }), TypeError);
  const adapter = createSolarSystemPresentationAdapter(THREE);
  assert.equal(adapter.getFrame({ bodies: [] }), null);
});
