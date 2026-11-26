import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTerrestrialTransportBase, TERRESTRIAL_BASE_PROFILE } from './terrestrialTransportBase.js';

test('BT-01 waits for the global DEM and then anchors its structure to the sampled surface', () => {
  const frame = new THREE.Group();
  let demReady = false;
  let elevationRevision = 0;
  const earthSystem = {
    getSurfaceFrame: () => frame,
    getStatus: () => ({ terrain: { sourceGridReady: demReady, elevationSource: demReady ? 'NOAA ETOPO2022' : 'reference-sphere' } })
  };
  const earthTerrainReferenceCore = {
    resolveSurfacePosition: ({ latitudeDeg, longitudeDeg }) => ({
      localPosition: new THREE.Vector3(10 + elevationRevision, 20, 30),
      sample: { terrainNormal: new THREE.Vector3(0, 1, 0) },
      latitudeDeg, longitudeDeg
    })
  };
  const base = createTerrestrialTransportBase({ THREE, earthSystem, earthTerrainReferenceCore });
  assert.equal(base.isDemAnchored(), false);
  assert.equal(base.updatePlacement(), false);
  assert.equal(base.getStatus().state, 'waiting-for-dem');

  demReady = true;
  elevationRevision = 7;
  assert.equal(base.updatePlacement(), true);
  assert.equal(base.isDemAnchored(), true);
  assert.equal(base.getStatus().state, 'dem-anchored');
  assert.equal(base.group.position.x, 17);
  assert.equal(base.getProfile().id, TERRESTRIAL_BASE_PROFILE.id);
  assert.equal(base.getProfile().region, 'Jaú, São Paulo, Brasil');
  assert.equal(base.getProfile().latitudeDeg, -22.2964);
  assert.equal(base.getProfile().longitudeDeg, -48.5570);
  assert.ok(base.group.getObjectByName('BT01-Arrival-Apron'));
  assert.ok(base.group.getObjectByName('BT01-Arrival-Walkway'));
  assert.equal(base.pad.parent, base.group);
  // The transporter coordinate is the local origin: landing there places the
  // character above the pad, while the operations hall stays clear behind it.
  assert.equal(base.pad.position.x, 0);
  assert.equal(base.pad.position.z, 0);
  const hall = base.group.getObjectByName('BT01-Operations-Hall');
  assert.ok(hall.position.z + 9 / 2 < 0, 'operations hall must not cover the arrival point');
  base.dispose();
});
