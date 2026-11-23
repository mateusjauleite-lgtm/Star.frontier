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

  const pointLight = scene.children.find(object => object.isPointLight);
  assert.ok(pointLight);
  assert.equal(pointLight.distance, 40000);

  lighting.dispose();
  assert.equal(scene.children.includes(lighting.sun), false);
});
