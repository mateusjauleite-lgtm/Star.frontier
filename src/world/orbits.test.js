import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createOrbitSystem } from './orbits.js';

test('orbital satellite advances through the shared Earth gravity integrator', () => {
  const calls = [];
  const gravitySystem = {
    circularOrbitVelocity(position) {
      calls.push(['initialize', position]);
      return [0, 0, 1];
    },
    integrate(position, velocity, dt) {
      calls.push(['integrate', dt]);
      return {
        position: [position[0], position[1], position[2] + velocity[2] * dt],
        velocity
      };
    }
  };
  const system = createOrbitSystem({
    center: [10, 0, 0],
    radius: 100,
    gravitySystem
  });
  const satellite = system.group.children.find(child => child.type === 'Group');
  try {
    const before = satellite.getWorldPosition(new THREE.Vector3());
    system.update(0.04);
    const after = satellite.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(after.z - before.z - 0.04) < 1e-9);
    assert.ok(calls.some(([kind]) => kind === 'integrate'));
  } finally {
    system.dispose();
  }
});
