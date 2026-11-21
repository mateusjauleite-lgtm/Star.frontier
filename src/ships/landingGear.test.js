import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLandingGear } from './landingGear.js';

test('landing gear builds four compact articulated wheel assemblies', () => {
  const gear = createLandingGear(THREE);
  assert.equal(gear.contactPoints.length, 4);
  assert.equal(gear.assemblyPositions.length, 4);
  assert.equal(gear.group.name, 'Four-Point-Articulated-Wheel-Gear');
  const fixedMounts = [];
  gear.group.traverse(object => { if (object.name === 'Gear-Upper-Mount') fixedMounts.push(object); });
  assert.equal(fixedMounts.length, 4);
  assert.ok(fixedMounts.every(mount => mount.parent?.name.startsWith('Landing-Gear-Retract-Pivot-')));
  // The mounting brackets retract with their own wheel assembly instead of
  // remaining as exposed structures on the underside of the hull.

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
  gear.setDeployment(1);
  gear.update(1);
  for (const contact of gear.contactPoints) {
    assert.ok(contact.point.isVector3);
    assert.equal(contact.point.y, -25.72);
    assert.ok(contact.id.startsWith('gear-'));
  }
});


test('landing gear deployment API preserves wheel contact anchors and retracts all four pivots', () => {
  const gear = createLandingGear(THREE);
  assert.equal(gear.getDeployment(), 0);
  gear.setDeployment(1);
  gear.update(1);
  assert.equal(gear.getDeployment(), 1);
  for (const contact of gear.contactPoints) {
    assert.equal(contact.point.y, -25.72);
  }

  assert.equal(gear.setDeployment(0), 0);
  assert.equal(gear.getTargetDeployment(), 0);
  gear.update(1);
  assert.equal(gear.getDeployment(), 0);
  for (const contact of gear.contactPoints) {
    assert.ok(Number.isFinite(contact.point.x));
    assert.ok(Number.isFinite(contact.point.y));
    assert.ok(Number.isFinite(contact.point.z));
  }

  assert.equal(gear.setDeployment(1), 1);
  gear.update(1);
  for (const contact of gear.contactPoints) {
    assert.equal(contact.point.y, -25.72);
  }
});


test('landing gear starts retracted and smoothly tracks its deployment target', () => {
  const gear = createLandingGear(THREE);
  assert.equal(gear.getDeployment(), 0);
  gear.setDeployment(1);
  assert.equal(gear.getDeployment(), 0);
  gear.update(0.1);
  assert.ok(gear.getDeployment() > 0 && gear.getDeployment() < 1);
  gear.update(2);
  assert.equal(gear.getDeployment(), 1);
});
