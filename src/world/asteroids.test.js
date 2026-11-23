import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createAsteroidField,
  resolveAsteroidMineralType,
  getAsteroidMineralLabel
} from './asteroids.js';
import { RESOURCE_IDS } from '../core/resources/resourceCatalog.js';

test('asteroid field creates stable IDs, mineral identities and visible dilithium deposits', () => {
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
      assert.equal(asteroid.userData.mineralType, 'dilithium');
      assert.equal(asteroid.userData.mineralLabel, 'DILÍTIO');
    }
    for (const asteroid of field.asteroids.filter(item => !depositAsteroids.includes(item))) {
      assert.equal(asteroid.userData.mineralType, 'metal');
      assert.equal(asteroid.userData.mineralLabel, 'METAL');
    }
  } finally {
    field.dispose();
  }
});

test('mineral label changes to metal when a dilithium deposit is exhausted', () => {
  const scene = new THREE.Scene();
  const field = createAsteroidField(scene, { count: 4 });
  const asteroid = field.asteroids[0];
  const deposit = asteroid.userData.resources[RESOURCE_IDS.DILITHIUM_ORE];
  assert.equal(resolveAsteroidMineralType(asteroid), 'dilithium');
  deposit.amount = 0;
  assert.equal(field.updateMineralLabel(asteroid), 'METAL');
  assert.equal(asteroid.userData.mineralType, 'metal');
  assert.equal(getAsteroidMineralLabel('dilithium'), 'DILÍTIO');
  field.dispose();
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
