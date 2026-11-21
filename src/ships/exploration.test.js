import test from 'node:test';
import assert from 'node:assert/strict';
import { createExplorationShip } from './exploration.js';

test('ponte do Deck 1 contém estação física independente do Ship Computer', () => {
  const ship = createExplorationShip();
  const station = ship.visual.getObjectByName('Bridge-Ship-Management-Station');

  assert.ok(station, 'estação física deve existir no modelo 3D da nave');
  assert.deepEqual(station.position.toArray(), [-10.5, 8.91, -20]);
  assert.ok(station.getObjectByName('Management-Station-Floor-Plinth'));
  assert.ok(station.getObjectByName('Management-Station-Worktop'));
  assert.ok(station.getObjectByName('Management-Station-Touch-Display'));
  assert.ok(station.getObjectByName('Management-Station-Emitter-Recess'));
  assert.ok(station.getObjectByName('Management-Station-Emitter-Ring'));
});
