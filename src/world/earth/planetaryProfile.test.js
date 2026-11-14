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
  assert.equal(profile.render.visualRadiusUnits, 300);
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
