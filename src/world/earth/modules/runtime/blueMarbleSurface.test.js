import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EARTH_BLUE_MARBLE_TEXTURE_PATH,
  resolveEarthTextureUrl
} from './blueMarbleSurface.js';

test('packages the NASA natural-color base map under the app base path', () => {
  assert.equal(
    resolveEarthTextureUrl('./'),
    './earth/blue-marble-natural-color.jpg'
  );
  assert.equal(
    resolveEarthTextureUrl('/app/'),
    '/app/earth/blue-marble-natural-color.jpg'
  );
  assert.equal(
    EARTH_BLUE_MARBLE_TEXTURE_PATH,
    'earth/blue-marble-natural-color.jpg'
  );
});

test('normalizes a base path without duplicating separators', () => {
  assert.equal(
    resolveEarthTextureUrl('/app'),
    '/app/earth/blue-marble-natural-color.jpg'
  );
});
