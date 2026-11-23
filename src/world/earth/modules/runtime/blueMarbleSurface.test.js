import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EARTH_BLUE_MARBLE_TEXTURE_PATH,
  resolveEarthTextureUrl
} from './blueMarbleSurface.js';

test('packages the NASA Blue Marble texture under the app base path', () => {
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
