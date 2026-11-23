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


test('each asteroid receives a billboard mineral label positioned above its body', () => {
  const originalDocument = globalThis.document;
  const context = {
    clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
    quadraticCurveTo() {}, closePath() {}, fill() {}, stroke() {}, fillText() {}
  };
  globalThis.document = {
    createElement() {
      return { getContext: () => context };
    }
  };
  const scene = new THREE.Scene();
  const field = createAsteroidField(scene, { count: 4 });
  try {
    const labels = scene.children.filter(object => object.isSprite);
    assert.equal(labels.length, 4);
    const asteroid = field.asteroids[0];
    const label = labels.find(item =>
      item.userData.asteroidEntityId === asteroid.userData.entityId
    );
    assert.ok(label);
    field.update();
    assert.ok(label.position.y > asteroid.position.y + asteroid.userData.radius);
    asteroid.position.x += 12;
    field.update();
    assert.ok(Math.abs(label.position.x - asteroid.position.x) < 1e-9);
  } finally {
    field.dispose();
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
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

test('asteroids register as dynamic receivers of the planetary gravity field', () => {
  const scene = new THREE.Scene();
  const gravityCalls = [];
  const gravitySystem = {
    circularOrbitVelocity(position) {
      gravityCalls.push(['initialize', position]);
      return [0, 0, 2];
    },
    integrate(position, velocity, dt) {
      gravityCalls.push(['integrate', dt]);
      return {
        position: [position[0], position[1], position[2] + velocity[2] * dt],
        velocity
      };
    }
  };
  const field = createAsteroidField(scene, {
    count: 1,
    center: [100, 0, 0],
    spread: [0, 0, 0],
    gravitySystem
  });
  try {
    const asteroid = field.asteroids[0];
    assert.deepEqual(asteroid.userData.gravityVelocityMps, [0, 0, 2]);
    field.update(0.04);
    assert.ok(Math.abs(asteroid.position.z - 0.08) < 1e-9);
    assert.ok(gravityCalls.some(([kind]) => kind === 'integrate'));
  } finally {
    field.dispose();
  }
});
