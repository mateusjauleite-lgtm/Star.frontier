import test from 'node:test';
import assert from 'node:assert/strict';
import {
  terrariumTileCoordinate,
  decodeTerrariumElevation,
  sampleTerrariumTile,
  createTerrariumElevationProvider
} from './regionalElevation.js';

test('maps longitude and latitude to Web Mercator DEM tile coordinates', () => {
  const coordinate = terrariumTileCoordinate(0, 0, 2);
  assert.equal(coordinate.x, 2);
  assert.equal(coordinate.y, 2);
  assert.equal(coordinate.key, '2/2/2');
  assert.equal(terrariumTileCoordinate(180, 0, 2).x, 0);
});

test('clamps polar coordinates to the Web Mercator limit', () => {
  const north = terrariumTileCoordinate(0, 90, 4);
  assert.ok(north.y >= 0 && north.y < 16);
});

test('decodes Terrarium RGB elevations in meters', () => {
  assert.equal(decodeTerrariumElevation(128, 0, 0), 0);
  assert.equal(decodeTerrariumElevation(127, 255, 0), -1);
  assert.equal(decodeTerrariumElevation(128, 0, 128), 0.5);
  assert.ok(Number.isNaN(decodeTerrariumElevation(0, 0, 0, 0)));
  assert.ok(Number.isNaN(decodeTerrariumElevation(0, 0, 0, 255)));
});

test('bilinearly samples a decoded DEM tile', () => {
  const tile = { width: 2, height: 2, values: new Float32Array([0, 10, 20, 30]) };
  assert.equal(sampleTerrariumTile(tile, 0.5, 0.5), 15);
});


test('cached DEM sampling exposes the same bilinear value used by regional tiles', async () => {
  const pixel = new Uint8ClampedArray(2 * 2 * 4);
  for (let i = 0; i < 4; i++) {
    pixel[i * 4] = 128;
    pixel[i * 4 + 1] = 10;
    pixel[i * 4 + 2] = 0;
    pixel[i * 4 + 3] = 255;
  }
  const provider = createTerrariumElevationProvider({
    fetchImpl: async () => ({ ok: true, blob: async () => ({}) }),
    createImageBitmapImpl: async () => ({ width: 2, height: 2, close() {} }),
    createCanvasImpl: () => ({
      getContext: () => ({
        drawImage() {},
        getImageData: () => ({ data: pixel })
      })
    })
  });
  try {
    assert.equal(provider.sampleCached(0, 0, { zoom: 2 }), null);
    await provider.sampleBatch([{ longitudeDeg: 0, latitudeDeg: 0 }], { zoom: 2 });
    assert.equal(provider.sampleCached(0, 0, { zoom: 2 }), 10);
  } finally {
    provider.dispose();
  }
});
