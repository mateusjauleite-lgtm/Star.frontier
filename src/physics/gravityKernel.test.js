import test from 'node:test';
import assert from 'node:assert/strict';
import { createGravityKernel } from './gravityKernel.js';

test('uniform artificial gravity preserves its local reference direction', () => {
  const kernel = createGravityKernel();
  assert.deepEqual(kernel.acceleration({
    position: [4, 12, -3],
    uniformAcceleration: [0, -18, 0]
  }), [0, -18, 0]);
});

test('point-mass gravity accelerates toward the body center', () => {
  const kernel = createGravityKernel();
  const acceleration = kernel.acceleration({
    position: [10, 0, 0],
    bodies: [{ position: [0, 0, 0], mu: 1000 }]
  });
  assert.ok(acceleration[0] < 0);
  assert.equal(acceleration[1], 0);
  assert.equal(acceleration[2], 0);
  assert.ok(Math.abs(acceleration[0] + 10) < 1e-12);
});

test('gravity combines artificial and multiple natural fields', () => {
  const kernel = createGravityKernel();
  const acceleration = kernel.acceleration({
    position: [10, 0, 0],
    uniformAcceleration: [0, -2, 0],
    bodies: [
      { position: [0, 0, 0], mu: 1000 },
      { position: [20, 0, 0], mu: 1000 }
    ]
  });
  assert.ok(Math.abs(acceleration[0]) < 1e-12);
  assert.equal(acceleration[1], -2);
  assert.equal(acceleration[2], 0);
});

test('velocity integration applies acceleration and clamps speed', () => {
  const kernel = createGravityKernel();
  assert.deepEqual(kernel.integrateVelocity([0, 0, 0], [0, -10, 0], 0.5), [0, -5, 0]);
  const limited = kernel.integrateVelocity([0, 0, 0], [0, -10, 0], 1, 4);
  assert.deepEqual(limited, [0, -4, 0]);
});

test('gravity kernel rejects invalid states and supports disposal', () => {
  const kernel = createGravityKernel();
  assert.equal(kernel.acceleration({ position: [0, 0, 0], bodies: [{ position: [0, 0, 0], mu: 1 }] }), null);
  assert.equal(kernel.acceleration({ position: [NaN, 0, 0] }), null);
  kernel.dispose();
  assert.equal(kernel.acceleration({ position: [1, 0, 0] }), null);
});
