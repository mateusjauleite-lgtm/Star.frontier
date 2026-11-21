import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLandingGear } from './landingGear.js';

test('landing gear builds four compact articulated wheel assemblies', () => {
  const gear = createLandingGear(THREE);
  assert.equal(gear.contactPoints.length, 4);
  assert.equal(gear.assemblyPositions.length, 4);
  assert.equal(gear.group.name, 'Four-Point-Articulated-Wheel-Gear');

  let tires = 0;
  let oleoStruts = 0;
  gear.group.traverse(object => {
    if (object.name === 'Gear-Wheel-Tire') tires++;
    if (object.name === 'Gear-Oleo-Outer') oleoStruts++;
  });
  assert.equal(tires, 4);
  assert.equal(oleoStruts, 4);
});

test('wheel contact anchors are authored at the tire bottom, not at the old foot pads', () => {
  const gear = createLandingGear(THREE);
  for (const contact of gear.contactPoints) {
    assert.ok(contact.point.isVector3);
    assert.equal(contact.point.y, -25.72);
    assert.ok(contact.id.startsWith('gear-'));
  }
});


test('landing gear deployment API preserves wheel contact anchors and retracts all four pivots', () => {
  const gear = createLandingGear(THREE);
  assert.equal(gear.getDeployment(), 1);
  for (const contact of gear.contactPoints) {
    assert.equal(contact.point.y, -25.72);
  }

  assert.equal(gear.setDeployment(0), 0);
  assert.equal(gear.getDeployment(), 0);
  for (const contact of gear.contactPoints) {
    assert.ok(Number.isFinite(contact.point.x));
    assert.ok(Number.isFinite(contact.point.y));
    assert.ok(Number.isFinite(contact.point.z));
  }

  assert.equal(gear.setDeployment(1), 1);
  for (const contact of gear.contactPoints) {
    assert.equal(contact.point.y, -25.72);
  }
});
