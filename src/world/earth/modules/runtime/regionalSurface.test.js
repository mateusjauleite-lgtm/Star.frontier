import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  earthCubeFaceDirection,
  earthDirectionToLatLon,
  createEarthQuadtreeNode,
  getEarthQuadtreeChildren,
  selectEarthQuadtreeTiles,
  createEarthQuadtreeTileGeometry
} from './regionalSurface.js';

test('cube-sphere faces produce normalized directions', () => {
  for (let face = 0; face < 6; face++) {
    const direction = earthCubeFaceDirection(face, 0, 0);
    assert.ok(Math.abs(direction.length() - 1) < 1e-10);
  }
});

test('cube-sphere direction converts to valid geographic coordinates', () => {
  const geographic = earthDirectionToLatLon(earthCubeFaceDirection(4, 0, 0));
  assert.equal(geographic.longitudeDeg, 90);
  assert.equal(geographic.latitudeDeg, 0);
});

test('quadtree creates four deterministic children per node', () => {
  const root = createEarthQuadtreeNode(2);
  const children = getEarthQuadtreeChildren(root);
  assert.equal(children.length, 4);
  assert.deepEqual(children.map(node => node.key), [
    '2/1/0/0', '2/1/1/0', '2/1/0/1', '2/1/1/1'
  ]);
});

test('quadtree rejects invalid tile coordinates', () => {
  assert.equal(createEarthQuadtreeNode(6), null);
  assert.equal(createEarthQuadtreeNode(0, 2, 4, 0), null);
});

test('near-surface selection is bounded by the regional tile budget', () => {
  const camera = new THREE.Vector3(0, 0, 601);
  const tiles = selectEarthQuadtreeTiles(camera, 600, { maxLevel: 12, maxTiles: 32 });
  assert.ok(tiles.length > 0);
  assert.ok(tiles.length <= 32);
  assert.ok(tiles.every(tile => tile.level <= 12));
});

test('horizon fallback can still select regional tiles when the camera view cone rejects all tiles', () => {
  const camera = new THREE.Vector3(0, 0, 601);
  const lookingAway = new THREE.Vector3(0, 0, 1);
  const rejected = selectEarthQuadtreeTiles(camera, 600, {
    maxLevel: 8,
    maxTiles: 24,
    cameraForwardLocal: lookingAway,
    cameraFovDeg: 40,
    cameraAspect: 1
  });
  const horizonFallback = selectEarthQuadtreeTiles(camera, 600, {
    maxLevel: 8,
    maxTiles: 24
  });
  assert.equal(rejected.length, 0);
  assert.ok(horizonFallback.length > 0);
  assert.ok(horizonFallback.length <= 24);
});

test('tile geometry uses the requested segment budget and finite positions', () => {
  const geometry = createEarthQuadtreeTileGeometry(createEarthQuadtreeNode(4), 600, {
    segments: 8,
    elevationSampler: () => 0.25
  });
  assert.equal(geometry.attributes.position.count, 81);
  for (const value of geometry.attributes.position.array) assert.ok(Number.isFinite(value));
  geometry.dispose();
});

test('regional DEM blends to the shared global sampler at tile borders', () => {
  const node = createEarthQuadtreeNode(4);
  const dem = new Float32Array(9);
  dem.fill(100);
  const geometry = createEarthQuadtreeTileGeometry(node, 600, {
    segments: 2,
    elevationSampler: () => 0,
    elevationMeters: dem,
    elevationMetersToUnits: meters => meters * .01,
    skirtUnits: 0
  });
  const positions = geometry.attributes.position;
  const edgeRadius = Math.hypot(positions.getX(1), positions.getY(1), positions.getZ(1));
  const centerRadius = Math.hypot(positions.getX(4), positions.getY(4), positions.getZ(4));
  assert.ok(Math.abs(edgeRadius - 600) < 1e-4);
  assert.ok(Math.abs(centerRadius - 601) < 1e-4);
  geometry.dispose();
});

test('regional selection prioritizes tiles inside the camera view cone', () => {
  const camera = new THREE.Vector3(0, 0, 601);
  const forward = new THREE.Vector3(1, 0, 0);
  const tiles = selectEarthQuadtreeTiles(camera, 600, {
    maxLevel: 8,
    maxTiles: 24,
    cameraForwardLocal: forward,
    cameraFovDeg: 75,
    cameraAspect: 1.8
  });
  assert.ok(tiles.length > 0);
  assert.ok(tiles.length <= 24);
});
