import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngineeringWarpCore } from './warpCore.js';

test('núcleo de dobra contém condicionador e barramentos EPS isolados', () => {
  const core = createEngineeringWarpCore();
  assert.equal(core.name, 'Engineering-Warp-Core-Assembly');
  assert.ok(core.getObjectByName('Engineering-Plasma-Conditioning-Manifold'));
  assert.ok(core.getObjectByName('EPS-Critical-Bus-Housing'));
  assert.ok(core.getObjectByName('EPS-Operations-Bus-Housing'));
  assert.ok(core.getObjectByName('EPS-Warp-Deflector-Bus-Housing'));
  const branches = [];
  core.traverse(object => {
    if (object.userData.isolatedPowerBranch) branches.push(object.name);
  });
  assert.equal(branches.length, 3);
});
