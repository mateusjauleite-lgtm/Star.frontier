import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createEarthReferenceFrames } from './earthReferenceFrames.js';

const closeVector = (a, b, epsilon = 1e-6) => a.distanceTo(b) <= epsilon;

test('global and terrestrial transfers preserve world transforms', () => {
  const scene = new THREE.Scene();
  const earth = new THREE.Group();
  earth.position.set(12, -4, -850);
  scene.add(earth);
  const terrestrial = new THREE.Group();
  terrestrial.rotation.set(0.08, 0.7, 0.2);
  earth.add(terrestrial);
  const ship = new THREE.Group();
  ship.position.set(4, 7, -2);
  ship.rotation.set(0.2, -0.4, 0.1);
  scene.add(ship);
  const actor = new THREE.Group();
  actor.position.set(1, 2, 3);
  actor.rotation.set(-0.1, 0.3, 0.2);
  ship.add(actor);
  scene.updateMatrixWorld(true);
  const p = actor.getWorldPosition(new THREE.Vector3());
  const q = actor.getWorldQuaternion(new THREE.Quaternion());
  const frames = createEarthReferenceFrames({ globalFrame: scene, terrestrialFrame: terrestrial });

  assert.equal(frames.attachToSurface(actor), true);
  scene.updateMatrixWorld(true);
  assert.ok(closeVector(actor.getWorldPosition(new THREE.Vector3()), p));
  assert.ok(actor.getWorldQuaternion(new THREE.Quaternion()).angleTo(q) < 1e-6);
  assert.equal(frames.attachToGlobal(actor), true);
  scene.updateMatrixWorld(true);
  assert.ok(closeVector(actor.getWorldPosition(new THREE.Vector3()), p));
  assert.ok(actor.getWorldQuaternion(new THREE.Quaternion()).angleTo(q) < 1e-6);
});

test('surface alignment makes local +Y follow terrain normal', () => {
  const scene = new THREE.Scene();
  const terrestrial = new THREE.Group();
  terrestrial.rotation.set(0.2, 0.8, -0.1);
  scene.add(terrestrial);
  const actor = new THREE.Group();
  scene.add(actor);
  actor.position.set(50, 100, -700);
  const frames = createEarthReferenceFrames({ globalFrame: scene, terrestrialFrame: terrestrial });
  const normal = new THREE.Vector3(0.3, 0.9, -0.2).normalize();
  assert.equal(frames.alignToSurface(actor, normal, new THREE.Vector3(0, 0, -1)), true);
  const actualUp = new THREE.Vector3(0, 1, 0)
    .applyQuaternion(actor.getWorldQuaternion(new THREE.Quaternion())).normalize();
  assert.ok(actualUp.dot(normal) > 0.999999);
});

test('yaw around local normal keeps character up aligned', () => {
  const scene = new THREE.Scene();
  const terrestrial = new THREE.Group();
  scene.add(terrestrial);
  const actor = new THREE.Group();
  terrestrial.add(actor);
  const frames = createEarthReferenceFrames({ globalFrame: scene, terrestrialFrame: terrestrial });
  const normal = new THREE.Vector3(0.4, 0.7, 0.2).normalize();
  frames.alignToSurface(actor, normal, new THREE.Vector3(0, 0, -1));
  const before = new THREE.Vector3(0, 1, 0).applyQuaternion(actor.getWorldQuaternion(new THREE.Quaternion()));
  assert.equal(frames.rotateAroundWorldAxis(actor, normal, 0.8), true);
  const after = new THREE.Vector3(0, 1, 0).applyQuaternion(actor.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(before.dot(after) > 0.999999);
});
