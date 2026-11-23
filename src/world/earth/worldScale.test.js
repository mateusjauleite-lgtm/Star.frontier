import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EARTH_RENDER_RADIUS_UNITS,
  EARTH_WORLD_SCALE_FACTOR,
  EARTH_WORLD_CENTER,
  EARTH_ORBIT_RADIUS_UNITS,
  ASTEROID_FIELD_CENTER,
  ASTEROID_FIELD_MIN_DISTANCE_UNITS
} from './worldScale.js';

test('Earth render radius uses kilometres as render units without changing ship geometry', () => {
  assert.ok(Math.abs(EARTH_RENDER_RADIUS_UNITS - 6371.0088) < 1e-9);
  assert.ok(Math.abs(EARTH_WORLD_SCALE_FACTOR - 6371.0088 / 600) < 1e-12);
  assert.ok(Math.abs(EARTH_WORLD_CENTER[2] + 850 * EARTH_WORLD_SCALE_FACTOR) < 1e-9);
});

test('Earth orbit remains outside the enlarged globe at the scaled legacy ratio', () => {
  assert.ok(EARTH_ORBIT_RADIUS_UNITS > EARTH_RENDER_RADIUS_UNITS);
  assert.ok(Math.abs(EARTH_ORBIT_RADIUS_UNITS / EARTH_RENDER_RADIUS_UNITS - 1.6) < 1e-12);
});

test('mining asteroid field is placed well beyond the Earth surface', () => {
  const centerDistance = Math.hypot(
    ASTEROID_FIELD_CENTER[0],
    ASTEROID_FIELD_CENTER[1],
    ASTEROID_FIELD_CENTER[2] - EARTH_WORLD_CENTER[2]
  );
  assert.ok(centerDistance > EARTH_RENDER_RADIUS_UNITS * 3.3);
  assert.ok(ASTEROID_FIELD_MIN_DISTANCE_UNITS > EARTH_RENDER_RADIUS_UNITS * 2.9);
});
