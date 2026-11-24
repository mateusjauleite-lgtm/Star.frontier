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
