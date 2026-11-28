import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  earthCubeFaceDirection,
  earthLongitudeToSphereUv,
  earthDirectionToLatLon,
  createEarthQuadtreeNode,
  getEarthQuadtreeChildren,
  selectEarthQuadtreeTiles,
  createEarthQuadtreeTileGeometry,
  getEarthQuadtreeNodeForDirection,
  createEarthRegionalSurfaceRuntime
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

test('near-surface ground anchor remains selected when the camera view cone points away from terrain', () => {
  const camera = new THREE.Vector3(0, 0, 601);
  const lookingAway = new THREE.Vector3(0, 0, 1);
  const selected = selectEarthQuadtreeTiles(camera, 600, {
    maxLevel: 8,
    maxTiles: 24,
    cameraForwardLocal: lookingAway,
    cameraFovDeg: 40,
    cameraAspect: 1
  });
  const anchor = getEarthQuadtreeNodeForDirection(camera, 8);
  assert.ok(selected.some(tile => tile.key === anchor.key));
  assert.ok(selected.length > 0);
  assert.ok(selected.length <= 24);
});

test('regional tile UVs use the same north-to-v=1 orientation as the globe texture', () => {
  const northGeometry = createEarthQuadtreeTileGeometry(createEarthQuadtreeNode(2), 600, {
    segments: 2,
    skirtUnits: 0
  });
  const southGeometry = createEarthQuadtreeTileGeometry(createEarthQuadtreeNode(3), 600, {
    segments: 2,
    skirtUnits: 0
  });
  assert.equal(northGeometry.attributes.uv.getY(4), 1);
  assert.equal(southGeometry.attributes.uv.getY(4), 0);
  northGeometry.dispose();
  southGeometry.dispose();
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

test('regional DEM geometry uses the same sampled elevation at tile borders and center', () => {
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
  assert.ok(Math.abs(edgeRadius - 601) < 1e-4);
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



test('maps a surface direction to its containing cube-sphere tile', () => {
  const tile = getEarthQuadtreeNodeForDirection(new THREE.Vector3(0, 0, 1), 12);
  assert.equal(tile.face, 4);
  assert.equal(tile.level, 12);
  assert.equal(getEarthQuadtreeNodeForDirection(new THREE.Vector3(0, 0, 0), 4), null);
});

test('keeps the ground-anchor tile when a third-person camera looks toward the horizon', () => {
  const camera = new THREE.Vector3(0, 0, 600);
  const tiles = selectEarthQuadtreeTiles(camera, 600, {
    maxLevel: 12,
    maxTiles: 24,
    cameraForwardLocal: new THREE.Vector3(1, 0, 0),
    cameraFovDeg: 55,
    cameraAspect: 1.8
  });
  const anchor = getEarthQuadtreeNodeForDirection(camera, 12);
  assert.ok(tiles.some(tile => tile.key === anchor.key));
  assert.ok(tiles.length <= 24);
});

test('keeps a local ground tile when camera position is slightly inside the collision radius', () => {
  const camera = new THREE.Vector3(0, 0, 599);
  const tiles = selectEarthQuadtreeTiles(camera, 600, {
    maxLevel: 12,
    maxTiles: 24,
    cameraForwardLocal: new THREE.Vector3(1, 0, 0)
  });
  assert.ok(tiles.length > 0);
  assert.ok(tiles.some(tile => tile.face === 4));
});

test('regional tiles use the same longitude UV convention as the global SphereGeometry', () => {
  assert.equal(earthLongitudeToSphereUv(0), 0.5);
  assert.equal(earthLongitudeToSphereUv(90), 0.25);
  assert.equal(earthLongitudeToSphereUv(-90), 0.75);
  assert.equal(earthLongitudeToSphereUv(180), 0);
  assert.equal(earthLongitudeToSphereUv(-180), 0);
  assert.equal(earthLongitudeToSphereUv(Number.NaN), null);
});


test('prepares the destination anchor tile before the camera arrives', async () => {
  const root = new THREE.Group();
  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(600, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  root.add(surface);
  const runtime = createEarthRegionalSurfaceRuntime({
    surface,
    radius: 600,
    elevationSampler: () => 0,
    sampleElevationMetersBatch: async points => {
      const values = new Float32Array(points.length);
      values.fill(100);
      return values;
    },
    elevationMetersToUnits: meters => meters * 0.01,
    maxLevel: 8,
    maxTiles: 24,
    segments: 2,
    buildPerUpdate: 2
  });

  const prepared = await runtime.prepareRegion({
    latitudeDeg: -22.2964,
    longitudeDeg: -48.557,
    altitudeUnits: 0
  });

  assert.equal(prepared.ok, true);
  assert.equal(prepared.elevationSource, 'regional-dem');
  assert.equal(runtime.getStatus().activeTiles, 1);
  assert.equal(runtime.getStatus().demTiles, 1);

  const loadedTexture = new THREE.Texture();
  surface.material.map = loadedTexture;
  surface.material.emissiveMap = loadedTexture;
  runtime.syncSurfaceMaterials();
  const preparedMesh = root.children.find(child => child.name.startsWith('Earth-Regional-Tile-'));
  assert.equal(preparedMesh.material.map, loadedTexture);
  assert.equal(preparedMesh.material.emissiveMap, loadedTexture);

  const distantCamera = new THREE.PerspectiveCamera(70, 1.8, 0.1, 10000);
  distantCamera.position.set(0, 0, 2000);
  distantCamera.lookAt(0, 0, 0);
  runtime.update(0.016, { camera: distantCamera });
  assert.equal(runtime.getStatus().preparedTiles, 1);
  assert.equal(runtime.getStatus().activeTiles, 1);

  runtime.dispose();
  loadedTexture.dispose();
  surface.geometry.dispose();
  surface.material.dispose();
});

test('rejects invalid destination coordinates without building tiles', async () => {
  const root = new THREE.Group();
  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(600, 8, 8),
    new THREE.MeshStandardMaterial()
  );
  root.add(surface);
  const runtime = createEarthRegionalSurfaceRuntime({ surface, radius: 600 });
  const result = await runtime.prepareRegion({ latitudeDeg: 91, longitudeDeg: 0 });
  assert.deepEqual(result, { ok: false, reason: 'invalid-region' });
  assert.equal(runtime.getStatus().activeTiles, 0);
  runtime.dispose();
  surface.geometry.dispose();
  surface.material.dispose();
});


test('reselects visible regional tiles immediately after a meaningful camera turn', () => {
  const root = new THREE.Group();
  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(600, 8, 8),
    new THREE.MeshStandardMaterial()
  );
  root.add(surface);
  const camera = new THREE.PerspectiveCamera(70, 1.8, 0.1, 10000);
  camera.position.set(0, 0, 700);
  camera.lookAt(700, 0, 0);
  const runtime = createEarthRegionalSurfaceRuntime({
    surface,
    radius: 600,
    elevationSampler: () => 0,
    maxLevel: 8,
    maxTiles: 24,
    segments: 2,
    buildPerUpdate: 1
  });

  runtime.update(0.016, { camera });
  const firstSelection = runtime.getStatus().selectedKeys;
  camera.lookAt(0, 700, 0);
  runtime.update(0.016, { camera });
  const turnedSelection = runtime.getStatus().selectedKeys;

  assert.ok(firstSelection.length > 0);
  assert.notDeepEqual(turnedSelection, firstSelection);

  runtime.dispose();
  surface.geometry.dispose();
  surface.material.dispose();
});
