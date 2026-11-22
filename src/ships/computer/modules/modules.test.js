import test from 'node:test';
import assert from 'node:assert/strict';
import { SHIP_COMPUTER_MODULES, getShipComputerModule } from './index.js';

test('computer module manifest exposes the seven registered applications in stable order', () => {
  assert.deepEqual(
    SHIP_COMPUTER_MODULES.map(module => module.id),
    ['navigation', 'tactical', 'weapons', 'engineering', 'warp-core', 'deflector', 'onboard-ai', 'defense', 'diagnostics']
  );
  assert.equal(Object.isFrozen(SHIP_COMPUTER_MODULES), true);
});

test('future branches are declared without pretending their systems are operational', () => {
  assert.equal(getShipComputerModule('weapons').systemId, null);
  assert.equal(getShipComputerModule('defense').phase, 'prepared');
  assert.equal(getShipComputerModule('warp-core').systemId, 'power');
  assert.equal(getShipComputerModule('warp-core').phase, 'operational');
  assert.equal(getShipComputerModule('deflector').systemId, 'deflector');
  assert.equal(getShipComputerModule('deflector').phase, 'operational');
  assert.equal(getShipComputerModule('unknown'), null);
});
