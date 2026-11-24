import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createEarthTerrainReferenceCore } from './earthTerrainReferenceCore.js';

test('attaches a terrain reference at a validated geographic coordinate', () => {
  const earthGroup = new THREE.Group();
  const earthSystem = {
    group: earthGroup,
    getPhysicalScale: () => ({ renderUnitsPerMeter: 0.5, metersToRenderUnits: value => value * 0.5 }),
    getCollisionSurface: () => ({
      sample: () => ({
        localPosition: new THREE.Vector3(0, 10, 0),
        terrainNormal: new THREE.Vector3(0, 1, 0)
      })
    })
  };
  const scene = new THREE.Scene();
  scene.add(earthGroup);
  const core = createEarthTerrainReferenceCore({ THREE, earthSystem, scene });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
  const record = core.attach(mesh, {
    id: 'test-block', latitudeDeg: -22.29, longitudeDeg: -48.56,
    elevationMeters: 20, metersPerModelUnit: 2
  });
  assert.equal(record.id, 'test-block');
  assert.equal(record.meshCount, 1);
  assert.equal(mesh.parent, earthGroup);
  assert.equal(mesh.position.y, 20);
  assert.equal(mesh.scale.x, 1);
  assert.equal(core.listReferences().length, 1);
  assert.equal(core.removeReference('test-block'), true);
  assert.equal(core.getStatus().referenceCount, 0);
  core.dispose();
});

test('rejects missing georeference and unsupported geometry', () => {
  const earthSystem = {
    group: new THREE.Group(),
    getPhysicalScale: () => ({ renderUnitsPerMeter: 1 }),
    getCollisionSurface: () => ({ sample: () => null })
  };
  const core = createEarthTerrainReferenceCore({ THREE, earthSystem, scene: new THREE.Scene() });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  assert.throws(() => core.attach(mesh, { id: 'missing-coordinates' }), /latitude/);
  assert.throws(() => core.attach(new THREE.Group(), {
    id: 'no-mesh', latitudeDeg: 0, longitudeDeg: 0
  }), /Nenhuma malha/);
  core.dispose();
});


test('uses an imported georeferenced terrain mesh as the local collision and transport surface', () => {
  const earthGroup = new THREE.Group();
  const earthSystem = {
    group: earthGroup,
    getPhysicalScale: () => ({ renderUnitsPerMeter: 0.5, metersToRenderUnits: value => value * 0.5 }),
    getCollisionSurface: () => ({
      sample: () => ({
        localPosition: new THREE.Vector3(0, 10, 0),
        terrainNormal: new THREE.Vector3(0, 1, 0)
      })
    })
  };
  const scene = new THREE.Scene();
  scene.add(earthGroup);
  const core = createEarthTerrainReferenceCore({ THREE, earthSystem, scene });
  const terrain = new THREE.Mesh(
    new THREE.BoxGeometry(10, 2, 10),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
  );
  core.attach(terrain, {
    id: 'regional-valley',
    name: 'Vale de teste',
    latitudeDeg: -22.29,
    longitudeDeg: -48.56,
    metersPerModelUnit: 2,
    surfaceRole: 'terrain'
  });

  const resolved = core.resolveSurfacePosition({
    latitudeDeg: -22.29,
    longitudeDeg: -48.56,
    elevationMeters: 0
  });
  assert.equal(resolved.regional, true);
  assert.equal(resolved.regionalReferenceId, 'regional-valley');
  assert.ok(Math.abs(resolved.worldPosition.y - 21) < 1e-6);
  assert.ok(resolved.worldNormal.y > 0.99);
  assert.equal(core.getStatus().collidableTerrainCount, 1);
  assert.equal(core.listReferences()[0].destinationEnabled, true);
  core.dispose();
});

test('keeps ordinary imported objects as visual overlays instead of collision terrain', () => {
  const earthSystem = {
    group: new THREE.Group(),
    getPhysicalScale: () => ({ renderUnitsPerMeter: 1, metersToRenderUnits: value => value }),
    getCollisionSurface: () => ({
      sample: () => ({
        localPosition: new THREE.Vector3(0, 10, 0),
        terrainNormal: new THREE.Vector3(0, 1, 0)
      })
    })
  };
  const core = createEarthTerrainReferenceCore({ THREE, earthSystem, scene: new THREE.Scene() });
  const object = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  const record = core.attach(object, {
    id: 'outpost-prop', latitudeDeg: 0, longitudeDeg: 0
  });
  assert.equal(record.surfaceRole, 'overlay');
  assert.equal(record.collisionEnabled, false);
  assert.equal(record.destinationEnabled, false);
  assert.equal(core.getStatus().collidableTerrainCount, 0);
  core.dispose();
});
