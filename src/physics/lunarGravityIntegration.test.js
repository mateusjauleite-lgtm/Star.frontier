import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlanetaryGravitySystem } from './planetaryGravitySystem.js';

test('planetary gravity sums Earth and Moon inverse-square fields', () => {
  const earthMu = 3.986004418e14;
  const moonMu = 4.9048695e12;
  const system = createPlanetaryGravitySystem({
    getEarthCenter: () => [0, 0, 0],
    gravitationalParameter: earthMu,
    getAdditionalGravityBodies: () => [{ position: [1000, 0, 0], mu: moonMu }]
  });
  const position = [500, 0, 0];
  const acceleration = system.accelerationAt(position);
  const expectedX = -earthMu / (500 ** 2) + moonMu / (500 ** 2);
  assert.ok(Math.abs(acceleration[0] - expectedX) < Math.abs(expectedX) * 1e-12);
  assert.equal(acceleration[1], 0);
  assert.equal(acceleration[2], 0);
});

test('additional invalid gravity sources are ignored without disabling Earth', () => {
  const system = createPlanetaryGravitySystem({
    getEarthCenter: () => [0, 0, 0],
    getAdditionalGravityBodies: () => [{ position: [NaN, 0, 0], mu: 1 }]
  });
  const acceleration = system.accelerationAt([10, 0, 0]);
  assert.ok(Math.abs(acceleration[0] + 3.986004418e12) < 1);
});
