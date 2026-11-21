import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAsteroidField } from './asteroids.js';
import { RESOURCE_IDS } from '../core/resources/resourceCatalog.js';

test('asteroid field creates stable asteroid IDs and visible dilithium deposits', () => {
  const scene = new THREE.Scene();
  const field = createAsteroidField(scene, { count: 8 });
  try {
    assert.equal(field.asteroids.length, 8);
    assert.equal(field.asteroids[0].userData.entityId, 'asteroid:mining-field:001');
    const depositAsteroids = field.asteroids.filter(asteroid =>
      Number(asteroid.userData.resources?.[RESOURCE_IDS.DILITHIUM_ORE]?.amount) > 0
    );
    assert.equal(depositAsteroids.length, 2);
    for (const asteroid of depositAsteroids) {
      const deposit = asteroid.getObjectByName('Dilithium-Ore-Deposit');
      assert.ok(deposit);
      assert.equal(deposit.userData.resourceId, RESOURCE_IDS.DILITHIUM_ORE);
      assert.equal(deposit.children.length, 3);
    }
  } finally {
    field.dispose();
  }
});

test('asteroid field removes an object and releases its visual resources', () => {
  const scene = new THREE.Scene();
  const field = createAsteroidField(scene, { count: 4 });
  const asteroid = field.asteroids[0];
  assert.equal(field.remove(asteroid), true);
  assert.equal(scene.children.includes(asteroid), false);
  assert.equal(field.asteroids.length, 3);
  assert.equal(field.remove(asteroid), false);
  field.dispose();
});
