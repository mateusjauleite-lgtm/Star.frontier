import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSpaceLighting, SUN_DISTANCE_SCALE } from './lighting.js';

test('Sun stays well separated from Earth while preserving the original light direction', () => {
  const scene = new THREE.Scene();
  const lighting = createSpaceLighting(scene, { starCount: 8, starRadius: 6500 });
  const originalDirection = new THREE.Vector3(-1760, 922, -2526).normalize();
  const actualDirection = lighting.sun.position.clone().normalize();

  assert.equal(SUN_DISTANCE_SCALE, 10);
  assert.ok(lighting.sun.position.length() > 25000);
  assert.ok(actualDirection.dot(originalDirection) > 0.999999);

  const sunMeshes = [];
  lighting.sun.traverse(object => {
    if (object.isMesh) sunMeshes.push(object);
  });
  assert.equal(sunMeshes.length, 3);
  assert.ok(sunMeshes.every(mesh => mesh.material.fog === false));

  // A iluminação solar é uma única fonte direcional; não deve existir
  // PointLight concorrente duplicando a iluminação da superfície.
  const directionalLights = scene.children.filter(object => object.isDirectionalLight);
  assert.equal(directionalLights.length, 2);
  assert.ok(directionalLights.some(light => light.color.getHex() === 0xffe0b5));
  assert.ok(directionalLights.some(light => light.color.getHex() === 0x5caaff));
  assert.equal(scene.children.some(object => object.isPointLight), false);

  lighting.dispose();
  assert.equal(scene.children.includes(lighting.sun), false);
  assert.equal(scene.children.some(object => object.isDirectionalLight), false);
});
