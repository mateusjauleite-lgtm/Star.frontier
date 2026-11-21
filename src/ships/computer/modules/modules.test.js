import test from 'node:test';
import assert from 'node:assert/strict';
import { SHIP_COMPUTER_MODULES, getShipComputerModule } from './index.js';

test('computer module manifest exposes the six planned branches in stable order', () => {
  assert.deepEqual(
    SHIP_COMPUTER_MODULES.map(module => module.id),
    ['navigation', 'tactical', 'weapons', 'engineering', 'defense', 'diagnostics']
  );
  assert.equal(Object.isFrozen(SHIP_COMPUTER_MODULES), true);
});

test('future branches are declared without pretending their systems are operational', () => {
  assert.equal(getShipComputerModule('weapons').systemId, null);
  assert.equal(getShipComputerModule('defense').phase, 'prepared');
  assert.equal(getShipComputerModule('unknown'), null);
});
