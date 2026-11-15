import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleEarthElevationGrid } from './terrain.js';

const grid = (values, extra = {}) => ({
  width: 2,
  height: 2,
  west: 0,
  east: 1,
  south: 0,
  north: 1,
  noDataValue: -32768,
  values: new Float32Array(values),
  ...extra
});

test('samples the ETOPO grid with north-to-south bilinear interpolation', () => {
  const elevation = sampleEarthElevationGrid(grid([100, 200, 300, 400]), 0.5, 0.5);
  assert.equal(elevation, 250);
});

test('returns exact node values at grid coordinates', () => {
  assert.equal(sampleEarthElevationGrid(grid([100, 200, 300, 400]), 0, 1), 100);
  assert.equal(sampleEarthElevationGrid(grid([100, 200, 300, 400]), 1, 0), 400);
});

test('rejects samples that require a no-data neighbour', () => {
  assert.equal(sampleEarthElevationGrid(grid([100, -32768, 300, 400]), 0.5, 0.5), null);
});

test('ignores no-data neighbours with zero interpolation weight', () => {
  assert.equal(sampleEarthElevationGrid(grid([100, -32768, 300, 400]), 0, 1), 100);
});

test('rejects invalid grids and clamps coordinates to the grid extent', () => {
  assert.equal(sampleEarthElevationGrid(null, 0, 0), null);
  assert.equal(sampleEarthElevationGrid(grid([1, 2, 3]), 0, 0), null);
  assert.equal(sampleEarthElevationGrid(grid([1, 2, 3, 4]), 0, 91), 1);
});


test('supports grids with different dimensions and resolutions', () => {
  const largerGrid = {
    width: 4,
    height: 3,
    west: -180,
    east: 180,
    south: -90,
    north: 90,
    values: new Float32Array([
      0, 10, 20, 30,
      40, 50, 60, 70,
      80, 90, 100, 110
    ])
  };
  assert.equal(sampleEarthElevationGrid(largerGrid, 60, 0), 60);
});

test('rejects grids with invalid geographic extents', () => {
  const invalidGrid = grid([1, 2, 3, 4], { west: 10, east: 10 });
  assert.equal(sampleEarthElevationGrid(invalidGrid, 10, 0), null);
});
