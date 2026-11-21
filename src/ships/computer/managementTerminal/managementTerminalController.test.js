import test from 'node:test';
import assert from 'node:assert/strict';
import { createShipComputer } from './shipComputer.js';
import {
  createShipManagementTerminalController
} from './managementTerminal/managementTerminalController.js';

function createHarness() {
  const computer = createShipComputer();
  computer.registerSystem('navigation', {
    commands: { telemetry: () => ({ heading: 1.2 }) }
  });
  computer.registerTerminal({
    id: 'ship-management-terminal',
    name: 'Gerenciamento',
    systems: ['navigation']
  });
  computer.boot();
  const calls = [];
  const renderer = {
    mount: options => { calls.push(['mount', Boolean(options.onClose)]); },
    render: value => calls.push(['render', value.present, value.open]),
    unmount: () => calls.push(['unmount'])
  };
  const changes = [];
  const controller = createShipManagementTerminalController({
    computer,
    renderer,
    onInteractionChange: active => changes.push(active)
  });
  return { computer, controller, calls, changes };
}

test('terminal holográfico permanece passivo até receber presença e interação', () => {
  const h = createHarness();
  h.controller.initialize();
  assert.equal(h.controller.open(), false);
  assert.equal(h.controller.setPresence(true), true);
  assert.equal(h.controller.getSnapshot().present, true);
  assert.equal(h.controller.getSnapshot().open, false);
  assert.equal(h.controller.open('TRIPULANTE'), true);
  assert.equal(h.computer.isTerminalConnected('ship-management-terminal'), true);
  assert.deepEqual(h.controller.dispatch('navigation', 'telemetry'), {
    ok: true,
    result: { heading: 1.2 }
  });
  assert.deepEqual(h.changes, [true]);
  h.controller.close();
  assert.equal(h.computer.isTerminalConnected('ship-management-terminal'), false);
  assert.deepEqual(h.changes, [true, false]);
  h.controller.shutdown();
});

test('perder presença fecha a interface e libera o terminal', () => {
  const h = createHarness();
  h.controller.initialize();
  h.controller.setPresence(true);
  assert.equal(h.controller.open(), true);
  h.controller.setPresence(false);
  assert.equal(h.controller.getSnapshot().open, false);
  assert.equal(h.computer.isTerminalConnected('ship-management-terminal'), false);
  h.controller.shutdown();
});

test('terminal de gerenciamento não acessa sistemas não autorizados', () => {
  const h = createHarness();
  h.controller.initialize();
  h.controller.setPresence(true);
  h.controller.open();
  assert.deepEqual(h.controller.dispatch('flight', 'movement', { x: 1, y: 0 }), {
    ok: false,
    reason: 'access-denied'
  });
  h.controller.shutdown();
});
