import test from 'node:test';
import assert from 'node:assert/strict';
import {
  terrariumTileCoordinate,
  decodeTerrariumElevation,
  sampleTerrariumTile
} from './regionalElevation.js';

test('maps longitude and latitude to Web Mercator DEM tile coordinates', () => {
  const coordinate = terrariumTileCoordinate(0, 0, 2);
  assert.equal(coordinate.x, 2);
  assert.equal(coordinate.y, 2);
  assert.equal(coordinate.key, '2/2/2');
});

test('clamps polar coordinates to the Web Mercator limit', () => {
  const north = terrariumTileCoordinate(0, 90, 4);
  assert.ok(north.y >= 0 && north.y < 16);
});

test('decodes Terrarium RGB elevations in meters', () => {
  assert.equal(decodeTerrariumElevation(128, 0, 0), 0);
  assert.equal(decodeTerrariumElevation(127, 255, 0), -1);
  assert.equal(decodeTerrariumElevation(128, 0, 128), 0.5);
});

test('bilinearly samples a decoded DEM tile', () => {
  const tile = { width: 2, height: 2, values: new Float32Array([0, 10, 20, 30]) };
  assert.equal(sampleTerrariumTile(tile, 0.5, 0.5), 15);
});
