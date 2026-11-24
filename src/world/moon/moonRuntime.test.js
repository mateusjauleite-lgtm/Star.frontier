import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMoonCore } from './moonCore.js';

test('Moon core has an independent frame and follows the astronomical snapshot', () => {
  const earthGroup = new THREE.Group();
  earthGroup.position.set(10, 20, 30);
  const moon = createMoonCore({
    earthSystem: { group: earthGroup },
    visualRadiusUnits: 100
  });
  assert.equal(moon.group.parent, null);
  assert.equal(moon.getSurfaceFrame().parent, moon.group);
  const applied = moon.applyAstronomicalState({
    relativePositions: { moon: new THREE.Vector3(384400000, 0, 0) },
    moonRotationAngleRad: 0.25,
    moonRotationAxis: [0, 1, 0]
  });
  assert.equal(applied, true);
  assert.equal(moon.group.position.x, 384400010);
  assert.equal(moon.group.position.y, 20);
  assert.equal(moon.group.position.z, 30);
  assert.ok(Math.abs(moon.getSurfaceFrame().rotation.y - 0.25) < 1e-9);
  assert.ok(Math.abs(moon.getLocalGravityAtDistance(1_737_400) - 1.6249) < 0.002);
  moon.dispose();
});
