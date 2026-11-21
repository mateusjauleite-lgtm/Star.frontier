import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createShipManagementHologram } from './shipManagementHologram.js';

test('holograma é ancorado ao referencial 3D da nave e inicia oculto', () => {
  const ship = new THREE.Group();
  const hologram = createShipManagementHologram({
    parent: ship,
    position: { x: -6.5, y: 8.91, z: -29.5 }
  });

  assert.equal(hologram.root.parent, ship);
  assert.equal(hologram.root.name, 'ShipManagementHologramAnchor');
  assert.equal(hologram.root.visible, false);
  assert.deepEqual(hologram.root.position.toArray(), [-6.5, 8.91, -29.5]);
  assert.equal(hologram.root.scale.x, 1.35);
  assert.ok(hologram.root.getObjectByName('ManagementHologramScanSweep'));

  hologram.setVisible(true);
  assert.equal(hologram.root.visible, true);
  const projection = hologram.root.getObjectByName('ManagementHologramProjection');
  const initialHeight = projection.position.y;
  hologram.update(1 / 60);
  hologram.update(1 / 60);
  assert.equal(hologram.root.visible, true);
  assert.notEqual(projection.position.y, initialHeight);
  assert.equal(hologram.dispose(), true);
  assert.equal(hologram.root.parent, null);
});
