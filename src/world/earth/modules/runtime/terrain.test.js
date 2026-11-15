import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleEarthElevationGrid } from './terrain.js';
import { loadEtopo2022GlobalGrid, parseEtopo2022Grid } from '../../references/etopo2022.js';
import { createEarthKernelAdapter } from '../../wasm/earthKernel.js';

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


test('converts ETOPO metres to the current 600-unit Earth scale', () => {
  const kernel = createEarthKernelAdapter();
  const oneKilometre = kernel.elevationMetersToUnits(1000, 600, 6371.0088, 8);
  assert.ok(Math.abs(oneKilometre - (600 / 6371.0088) * 8) < 1e-9);
  kernel.dispose();
});


function makeCompactEtopoBuffer(values = [10, 20, 30, 40]) {
  const headerBytes = 56;
  const buffer = new ArrayBuffer(headerBytes + values.length * 2);
  const bytes = new Uint8Array(buffer);
  bytes.set(new TextEncoder().encode('ETOPO22\0'), 0);
  const view = new DataView(buffer);
  view.setUint32(8, 2, true);
  view.setUint32(12, 2, true);
  view.setFloat64(16, -1, true);
  view.setFloat64(24, 1, true);
  view.setFloat64(32, -1, true);
  view.setFloat64(40, 1, true);
  view.setInt16(48, -32768, true);
  view.setUint16(50, 1, true);
  view.setUint32(52, headerBytes, true);
  values.forEach((value, index) => view.setInt16(headerBytes + index * 2, value, true));
  return buffer;
}

test('decodes the compact ETOPO binary header and elevation samples', () => {
  const grid = parseEtopo2022Grid(makeCompactEtopoBuffer());
  assert.equal(grid.width, 2);
  assert.equal(grid.height, 2);
  assert.equal(grid.units, 'meters');
  assert.deepEqual(Array.from(grid.values), [10, 20, 30, 40]);
});

test('rejects compact ETOPO data with an invalid payload length', () => {
  const valid = makeCompactEtopoBuffer();
  assert.equal(parseEtopo2022Grid(valid.slice(0, valid.byteLength - 2)), null);
});

test('reports ETOPO loading success and returns the decoded grid', async () => {
  const statuses = [];
  const buffer = makeCompactEtopoBuffer();
  const grid = await loadEtopo2022GlobalGrid({
    url: 'https://example.test/etopo.bin',
    fetchImpl: async () => ({ ok: true, arrayBuffer: async () => buffer }),
    onStatus: status => statuses.push(status)
  });
  assert.equal(grid.width, 2);
  assert.equal(statuses[0].state, 'loading');
  assert.equal(statuses.at(-1).state, 'ready');
});

test('reports a missing ETOPO asset instead of silently hiding the failure', async () => {
  const statuses = [];
  const grid = await loadEtopo2022GlobalGrid({
    url: 'https://example.test/etopo.bin',
    fetchImpl: async () => ({ ok: false, status: 404 }),
    onStatus: status => statuses.push(status)
  });
  assert.equal(grid, null);
  assert.equal(statuses.at(-1).state, 'missing');
  assert.equal(statuses.at(-1).httpStatus, 404);
});

test('reports an invalid ETOPO binary payload', async () => {
  const statuses = [];
  const grid = await loadEtopo2022GlobalGrid({
    url: 'https://example.test/etopo.bin',
    fetchImpl: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(64) }),
    onStatus: status => statuses.push(status)
  });
  assert.equal(grid, null);
  assert.equal(statuses.at(-1).state, 'invalid');
});
