import test from 'node:test';
import assert from 'node:assert/strict';
import { createExternalElevator, EXTERNAL_ELEVATOR_CONFIG } from './externalElevator.js';

test('external elevator travels down and returns to the Deck 4 stop', () => {
  const elevator = createExternalElevator({ deckY: -8.7 });
  try {
    assert.equal(elevator.phase, 'top');
    assert.equal(elevator.begin('down'), true);
    assert.equal(elevator.moving, true);
    assert.equal(elevator.update(EXTERNAL_ELEVATOR_CONFIG.travelSeconds / 2), null);
    assert.ok(elevator.platform.position.y < 0);
    assert.equal(elevator.update(EXTERNAL_ELEVATOR_CONFIG.travelSeconds), 'bottom');
    assert.equal(elevator.phase, 'bottom');
    assert.equal(elevator.platform.position.y, -EXTERNAL_ELEVATOR_CONFIG.travelDistance);

    assert.equal(elevator.begin('up'), true);
    assert.equal(elevator.update(EXTERNAL_ELEVATOR_CONFIG.travelSeconds), 'top');
    assert.equal(elevator.phase, 'top');
    assert.equal(elevator.platform.position.y, 0);
  } finally {
    elevator.dispose();
  }
});

test('external elevator rejects travel commands that do not match its stop', () => {
  const elevator = createExternalElevator();
  try {
    assert.equal(elevator.begin('up'), false);
    assert.equal(elevator.begin('down'), true);
    assert.equal(elevator.begin('down'), false);
    elevator.update(EXTERNAL_ELEVATOR_CONFIG.travelSeconds);
    assert.equal(elevator.begin('down'), false);
    assert.equal(elevator.begin('up'), true);
  } finally {
    elevator.dispose();
  }
});

test('external elevator exposes a top-only contact area matching its moving platform', () => {
  const elevator = createExternalElevator({ deckY: -8.7 });
  try {
    elevator.begin('down');
    elevator.update(EXTERNAL_ELEVATOR_CONFIG.travelSeconds);
    const surface = elevator.getPlatformSurfaceWorld();
    const pointAboveDeck = surface.center.clone().addScaledVector(surface.normal, 0.12);
    const contact = elevator.getPlatformContact(pointAboveDeck);
    assert.equal(contact.inside, true);
    assert.ok(Math.abs(contact.clearance - 0.12) < 1e-6);

    const pointOutside = surface.center.clone().add(new (surface.center.constructor)(2.2, 0, 0));
    assert.equal(elevator.getPlatformContact(pointOutside).inside, false);
  } finally {
    elevator.dispose();
  }
});

test('external elevator remains stopped until the character issues an explicit command', () => {
  const elevator = createExternalElevator();
  try {
    assert.equal(elevator.phase, 'top');
    assert.equal(elevator.moving, false);
    assert.equal(elevator.update(10), null);
    assert.equal(elevator.phase, 'top');
    assert.equal(elevator.platform.position.y, 0);
  } finally {
    elevator.dispose();
  }
});
