import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EARTH_DEFAULT_TERRAIN_VERTICAL_EXAGGERATION,
  EARTH_NO_DEM_FALLBACK_ELEVATION_METERS,
  sampleEarthElevationGrid,
  calculateEtopoPatchSegments
} from './terrain.js';
import { EARTH_GLOBAL_SURFACE_SEGMENTS, EARTH_LOD_SEGMENTS, selectEarthLodLevel } from './surface.js';
import { ETOPO_2022_GLOBAL_GRID, loadEtopo2022GlobalGrid, parseEtopo2022Grid } from '../../references/etopo2022.js';
import { createEarthKernelAdapter } from '../../wasm/earthKernel.js';

test('uses physical 1x terrain elevation by default', () => {
  assert.equal(EARTH_DEFAULT_TERRAIN_VERTICAL_EXAGGERATION, 1);
  assert.equal(EARTH_NO_DEM_FALLBACK_ELEVATION_METERS, 0);
});

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

test('production ETOPO asset contract matches the 0.25-degree global grid', () => {
  assert.equal(ETOPO_2022_GLOBAL_GRID.width, 1440);
  assert.equal(ETOPO_2022_GLOBAL_GRID.height, 720);
  assert.equal(ETOPO_2022_GLOBAL_GRID.resolutionArcSeconds, 900);
  assert.equal(ETOPO_2022_GLOBAL_GRID.sourceResolutionArcSeconds, 60);
  assert.equal(ETOPO_2022_GLOBAL_GRID.wrapLongitude, true);
  assert.equal(ETOPO_2022_GLOBAL_GRID.longitudePeriod, 360);
  assert.equal(ETOPO_2022_GLOBAL_GRID.verticalDatum, 'EGM2008 geoid');
});


test('sizes the regional terrain patch to the packaged ETOPO grid spacing', () => {
  const etopoGrid = {
    width: 1440,
    height: 720,
    west: -179.875,
    east: 179.875,
    south: -89.875,
    north: 89.875
  };
  assert.equal(calculateEtopoPatchSegments(750, 0, etopoGrid), 27);
  assert.equal(calculateEtopoPatchSegments(750, 60, etopoGrid), 54);
  assert.equal(calculateEtopoPatchSegments(750, 80, etopoGrid), 128);
});

test('keeps the global ETOPO source independent from the active render-mesh resolution', () => {
  assert.equal(ETOPO_2022_GLOBAL_GRID.width, 1440);
  assert.equal(ETOPO_2022_GLOBAL_GRID.height, 720);
  assert.equal(EARTH_GLOBAL_SURFACE_SEGMENTS.width, 360);
  assert.equal(EARTH_GLOBAL_SURFACE_SEGMENTS.height, 180);
  assert.deepEqual(EARTH_LOD_SEGMENTS, [
    { width: 144, height: 72 },
    { width: 216, height: 108 },
    { width: 360, height: 180 },
    { width: 540, height: 270 }
  ]);
  const vertexCounts = EARTH_LOD_SEGMENTS.map(level =>
    (level.width + 1) * (level.height + 1)
  );
  // The coarsest global LOD is intentionally lightweight at 10,585 vertices.
  assert.ok(vertexCounts[0] < 11000);
  assert.ok(vertexCounts[3] < 300000);
  assert.ok(vertexCounts[3] < ETOPO_2022_GLOBAL_GRID.width * ETOPO_2022_GLOBAL_GRID.height);
});

test('keeps Earth LOD stable around transition thresholds', () => {
  assert.equal(selectEarthLodLevel(4.0 * 600, 600, 0), 0);
  assert.equal(selectEarthLodLevel(3.8 * 600, 600, 0), 1);
  assert.equal(selectEarthLodLevel(1.4 * 600, 600, 3), 3);
  assert.equal(selectEarthLodLevel(1.5 * 600, 600, 3), 2);
});

test('batched elevation sampling matches the scalar ETOPO sampler', () => {
  const source = grid([100, 200, 300, 400]);
  const kernel = createEarthKernelAdapter();
  const longitudes = new Float32Array([0, 0.5, 1]);
  const latitudes = new Float32Array([1, 0.5, 0]);
  const batch = kernel.sampleElevationBatch(source, longitudes, latitudes);
  assert.deepEqual(Array.from(batch), [
    sampleEarthElevationGrid(source, 0, 1),
    sampleEarthElevationGrid(source, 0.5, 0.5),
    sampleEarthElevationGrid(source, 1, 0)
  ]);
  kernel.dispose();
});

test('global ETOPO interpolation wraps continuously across the antimeridian', () => {
  const seamGrid = {
    width: 4,
    height: 2,
    west: -135,
    east: 135,
    south: -90,
    north: 90,
    wrapLongitude: true,
    longitudePeriod: 360,
    values: new Float32Array([0, 10, 20, 30, 0, 10, 20, 30])
  };
  assert.equal(sampleEarthElevationGrid(seamGrid, 180, 0), 15);
  assert.equal(sampleEarthElevationGrid(seamGrid, -180, 0), 15);
  assert.equal(sampleEarthElevationGrid(seamGrid, 540, 0), 15);
});
