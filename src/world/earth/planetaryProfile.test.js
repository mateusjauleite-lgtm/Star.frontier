import test from 'node:test';
import assert from 'node:assert/strict';
import { EARTH_PLANETARY_PROFILE, createEarthPlanetaryProfile } from './planetaryProfile.js';

test('Earth physical radius is independent from visual radius', () => {
  const profile = createEarthPlanetaryProfile({ visualRadiusUnits: 300 });
  assert.equal(profile.physical.meanRadiusKm, 6371.0088);
  assert.equal(profile.render.visualRadiusUnits, 300);
  assert.ok(Math.abs(profile.conversion.kmToVisualUnits(6371.0088) - 300) < 1e-9);
});

test('Earth profile converts altitude without changing physical source values', () => {
  const profile = createEarthPlanetaryProfile({ visualRadiusUnits: 637.10088 });
  assert.ok(Math.abs(profile.conversion.kmToVisualUnits(10) - 1) < 1e-12);
  assert.ok(Math.abs(profile.conversion.visualUnitsToKm(1) - 10) < 1e-12);
  assert.equal(EARTH_PLANETARY_PROFILE.physical.meanRadiusKm, 6371.0088);
});

test('invalid visual radius falls back to the documented render default', () => {
  const profile = createEarthPlanetaryProfile({ visualRadiusUnits: 0 });
  assert.equal(profile.render.visualRadiusUnits, 600);
});

import { sampleEarthElevationGrid } from './modules/runtime/terrain.js';

test('global elevation grid samples bilinearly across a regular grid', () => {
  const grid = {
    width: 2, height: 2,
    values: new Float32Array([100, 200, 300, 400])
  };
  assert.equal(sampleEarthElevationGrid(grid, -180, 90), 100);
  assert.equal(sampleEarthElevationGrid(grid, 180, -90), 400);
  assert.equal(sampleEarthElevationGrid(grid, 0, 0), 250);
});

test('global elevation grid rejects invalid and no-data samples', () => {
  const grid = {
    width: 2, height: 2,
    values: new Float32Array([10, -9999, 30, 40]),
    noDataValue: -9999
  };
  assert.equal(sampleEarthElevationGrid(grid, -180, 90), 10);
  assert.equal(sampleEarthElevationGrid(grid, 180, 90), null);
  assert.equal(sampleEarthElevationGrid(null, 0, 0), null);
});

import { createEarthKernelAdapter } from './wasm/earthKernel.js';

test('Earth kernel JavaScript fallback samples elevation and ignores zero-weight no-data neighbours', () => {
  const kernel = createEarthKernelAdapter();
  const grid = {
    width: 2, height: 2,
    values: new Float32Array([10, -9999, 30, 40]),
    noDataValue: -9999
  };
  assert.equal(kernel.sampleElevation(grid, -180, 90), 10);
  assert.equal(kernel.sampleElevation(grid, 180, 90), null);
  assert.equal(kernel.sampleElevation(grid, 0, 0), null);
  assert.equal(kernel.backend, 'javascript-fallback');
});

test('Earth kernel fallback converts physical elevation into visual units', () => {
  const kernel = createEarthKernelAdapter();
  assert.ok(Math.abs(kernel.elevationMetersToUnits(1000, 300, 6371.0088, 8) - (300 / 6371.0088 * 8)) < 1e-9);
  kernel.dispose();
  assert.equal(kernel.elevationMetersToUnits(1000, 300, 6371.0088, 8), null);
});

test('Earth kernel fallback supports batched elevation samples', () => {
  const kernel = createEarthKernelAdapter();
  const grid = { width: 2, height: 2, values: new Float32Array([100, 200, 300, 400]) };
  const result = kernel.sampleElevationBatch(
    grid, new Float32Array([-180, 0, 180]), new Float32Array([90, 0, -90])
  );
  assert.deepEqual(Array.from(result), [100, 250, 400]);
});


import { selectEarthLodLevel } from './modules/runtime/surface.js';

test('Earth global LOD selects lower mesh detail at greater camera distances', () => {
  assert.equal(selectEarthLodLevel(3000, 600), 0);
  assert.equal(selectEarthLodLevel(1500, 600), 1);
  assert.equal(selectEarthLodLevel(800, 600), 2);
});

test('Earth global LOD preserves close-range detail for invalid camera measurements', () => {
  assert.equal(selectEarthLodLevel(NaN, 600), 3);
  assert.equal(selectEarthLodLevel(100, 0), 3);
});

test('Earth procedural detail safely remains unavailable before the WASM kernel loads', () => {
  const kernel = createEarthKernelAdapter();
  assert.equal(kernel.proceduralDetailMeters(0, 0, 2600), null);
  assert.equal(kernel.proceduralDetailMeters(NaN, 0, 2600), null);
  kernel.dispose();
});


import { parseEtopo2022Grid } from './references/etopo2022.js';

test('ETOPO binary parser reads a north-to-south Int16 global grid', () => {
  const width = 2, height = 2, headerBytes = 56;
  const buffer = new ArrayBuffer(headerBytes + width * height * 2);
  const view = new DataView(buffer);
  const magic = new TextEncoder().encode('ETOPO22\0');
  new Uint8Array(buffer, 0, 8).set(magic);
  view.setUint32(8, width, true);
  view.setUint32(12, height, true);
  view.setFloat64(16, -180, true);
  view.setFloat64(24, 180, true);
  view.setFloat64(32, -90, true);
  view.setFloat64(40, 90, true);
  view.setInt16(48, -32768, true);
  view.setUint16(50, 1, true);
  view.setUint32(52, headerBytes, true);
  [100, 200, 300, -32768].forEach((value, index) =>
    view.setInt16(headerBytes + index * 2, value, true)
  );

  const grid = parseEtopo2022Grid(buffer);
  assert.ok(grid);
  assert.deepEqual(Array.from(grid.values), [100, 200, 300, -32768]);
  assert.equal(grid.verticalDatum, 'EGM2008 geoid');
  assert.equal(grid.units, 'meters');
});

test('ETOPO binary parser rejects a truncated or unrelated asset', () => {
  assert.equal(parseEtopo2022Grid(new ArrayBuffer(12)), null);
  const invalid = new ArrayBuffer(64);
  assert.equal(parseEtopo2022Grid(invalid), null);
});
