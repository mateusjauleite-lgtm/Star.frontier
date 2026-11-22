import test from 'node:test';
import assert from 'node:assert/strict';
import { createShipComputer } from '../shipComputer.js';
import {
  createShipManagementTerminalController,
  SHIP_MANAGEMENT_TERMINAL_LOCAL_POSITION,
  SHIP_MANAGEMENT_TERMINAL_INTERACTION_RADIUS
} from './managementTerminalController.js';
import { PILOT_CONSOLE_LOCAL_POSITION } from '../../bridge/commandBridge.js';

function createHarness() {
  const computer = createShipComputer();
  computer.registerSystem('navigation', {
    commands: { telemetry: () => ({ heading: 1.2 }) }
  });
  computer.registerSystem('power', { commands: { status: () => ({ available: true, warpCore: { reserve: 44 } }) } });
  computer.registerTerminal({
    id: 'ship-management-terminal',
    name: 'Gerenciamento',
    systems: ['navigation', 'power']
  });
  computer.boot();
  const calls = [];
  const mounted = {};
  const renderer = {
    mount: options => { mounted.options = options; calls.push(['mount', Boolean(options.onClose)]); },
    render: value => calls.push(['render', value.present, value.open]),
    unmount: () => calls.push(['unmount'])
  };
  const changes = [];
  const controller = createShipManagementTerminalController({
    computer,
    renderer,
    onInteractionChange: active => changes.push(active)
  });
  return { computer, controller, calls, changes, mounted };
}

test('terminal holográfico permanece passivo até receber presença e interação', () => {
  const h = createHarness();
  h.controller.initialize();
  assert.equal(h.controller.open(), false);
  assert.equal(h.controller.setPresence(true, false), true);
  assert.equal(h.controller.open(), false);
  assert.equal(h.controller.setPresence(true, true), true);
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
  h.controller.setPresence(true, true);
  assert.equal(h.controller.open(), true);
  h.controller.setPresence(false);
  assert.equal(h.controller.getSnapshot().open, false);
  assert.equal(h.computer.isTerminalConnected('ship-management-terminal'), false);
  h.controller.shutdown();
});

test('terminal de gerenciamento não acessa sistemas não autorizados', () => {
  const h = createHarness();
  h.controller.initialize();
  h.controller.setPresence(true, true);
  h.controller.open();
  assert.deepEqual(h.controller.dispatch('flight', 'movement', { x: 1, y: 0 }), {
    ok: false,
    reason: 'access-denied'
  });
  h.controller.shutdown();
});

test('estação de gerenciamento fica separada do raio de interação do posto de pilotagem', () => {
  const distance = Math.hypot(
    SHIP_MANAGEMENT_TERMINAL_LOCAL_POSITION.x - PILOT_CONSOLE_LOCAL_POSITION.x,
    SHIP_MANAGEMENT_TERMINAL_LOCAL_POSITION.z - PILOT_CONSOLE_LOCAL_POSITION.z
  );
  assert.ok(distance > SHIP_MANAGEMENT_TERMINAL_INTERACTION_RADIUS + 5);
  assert.equal(SHIP_MANAGEMENT_TERMINAL_LOCAL_POSITION.y, 8.91);
});


test('aplicativo dedicado do núcleo de dobra consulta a telemetria real do Ship Computer', () => {
  const h = createHarness();
  h.controller.initialize();
  h.controller.setPresence(true, true);
  h.controller.open('TRIPULANTE');
  assert.ok(h.controller.getSnapshot().modules.includes('warp-core'));
  assert.equal(h.controller.selectModule('warp-core'), true);
  assert.equal(h.controller.getSnapshot().selectedModuleId, 'warp-core');
  h.controller.shutdown();
});

test('aplicativo da Alexia encaminha texto ao núcleo único e recupera histórico', () => {
  const h = createHarness();
  h.controller.initialize();
  h.controller.setPresence(true, true);
  h.controller.open('PILOTO');
  assert.equal(h.controller.selectModule('onboard-ai'), true);
  const response = h.mounted.options.onAIMessage('qual a situação da nave?');
  assert.equal(response.ok, true);
  assert.equal(response.intent, 'telemetry');
  assert.equal(h.computer.onboardAI.getConversationHistory().length, 2);
  h.controller.shutdown();
});


test('envio no chat preserva o renderer montado para não remover o campo focado no Android', () => {
  const h = createHarness();
  h.controller.initialize();
  h.controller.setPresence(true, true);
  h.controller.open('PILOTO');
  h.controller.selectModule('onboard-ai');
  const renderCountBeforeMessage = h.calls.filter(([name]) => name === 'render').length;

  const response = h.mounted.options.onAIMessage('qual a situação da nave?');

  assert.equal(response.ok, true);
  assert.equal(h.computer.onboardAI.getConversationHistory().length, 2);
  assert.equal(h.calls.filter(([name]) => name === 'render').length, renderCountBeforeMessage);
  h.controller.shutdown();
});
