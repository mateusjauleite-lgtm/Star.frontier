import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAuxiliaryStabilizationAcceleration } from './auxiliaryThrusterSystem.js';

test('auxiliares amortecem deriva lateral sem alterar a velocidade radial', () => {
  const acceleration = calculateAuxiliaryStabilizationAcceleration({
    velocity: [8, -4, 0],
    radialUp: [0, 1, 0],
    altitudeMeters: 800
  });
  assert.deepEqual(acceleration, [-12, 0, 0]);
});

test('auxiliares ficam inativos fora da zona de precisão ou quando desligados', () => {
  assert.deepEqual(calculateAuxiliaryStabilizationAcceleration({
    velocity: [8, 0, 0], altitudeMeters: 5001
  }), [0, 0, 0]);
  assert.deepEqual(calculateAuxiliaryStabilizationAcceleration({
    velocity: [8, 0, 0], altitudeMeters: 800, enabled: false
  }), [0, 0, 0]);
});
