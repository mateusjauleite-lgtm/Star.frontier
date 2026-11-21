import test from 'node:test';
import assert from 'node:assert/strict';
import { createShipComputer } from './shipComputer.js';

test('terminais independentes podem permanecer conectados simultaneamente', () => {
  const computer = createShipComputer();
  computer.registerSystem('navigation', { commands: { status: () => 'online' } });
  computer.registerTerminal({ id: 'pilot-station', systems: [] });
  computer.registerTerminal({ id: 'ship-management-terminal', systems: ['navigation'] });
  computer.boot();

  assert.equal(computer.connectTerminal('pilot-station'), true);
  assert.equal(computer.connectTerminal('ship-management-terminal', 'TRIPULANTE'), true);
  assert.equal(computer.isTerminalConnected('pilot-station'), true);
  assert.equal(computer.isTerminalConnected('ship-management-terminal'), true);
  assert.equal(computer.dispatch('ship-management-terminal', 'navigation', 'status').result, 'online');

  computer.disconnectTerminal('ship-management-terminal');
  assert.equal(computer.isTerminalConnected('pilot-station'), true);
  assert.equal(computer.isTerminalConnected('ship-management-terminal'), false);
  computer.shutdown();
  assert.equal(computer.isTerminalConnected('pilot-station'), false);
});
