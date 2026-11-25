import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EARTH_BLUE_MARBLE_TEXTURE_PATH,
  resolveEarthTextureUrl,
  createBlueMarbleSurfaceRuntime
} from './blueMarbleSurface.js';

test('packages the NASA topography/bathymetry texture under the app base path', () => {
  assert.equal(
    resolveEarthTextureUrl('./'),
    './earth/blue-marble-topography-bathymetry.jpg'
  );
  assert.equal(
    resolveEarthTextureUrl('/app/'),
    '/app/earth/blue-marble-topography-bathymetry.jpg'
  );
  assert.equal(
    EARTH_BLUE_MARBLE_TEXTURE_PATH,
    'earth/blue-marble-topography-bathymetry.jpg'
  );
});

test('normalizes a base path without duplicating separators', () => {
  assert.equal(
    resolveEarthTextureUrl('/app'),
    '/app/earth/blue-marble-topography-bathymetry.jpg'
  );
});


test('surface runtime leaves absolute spin ownership to the astronomical clock', () => {
  const rotations = { y: 1.25 };
  const surfaceFrame = { rotation: rotations };
  const runtime = createBlueMarbleSurfaceRuntime({ surfaceFrame, options: { radius: 1 }, layers: {} });
  runtime.update(10, {});
  assert.equal(rotations.y, 1.25);
});
