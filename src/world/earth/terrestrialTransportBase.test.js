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
  base.dispose();
});
