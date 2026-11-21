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

  hologram.setVisible(true);
  assert.equal(hologram.root.visible, true);
  hologram.update(1 / 60);
  assert.equal(hologram.root.visible, true);
  assert.equal(hologram.dispose(), true);
  assert.equal(hologram.root.parent, null);
});
