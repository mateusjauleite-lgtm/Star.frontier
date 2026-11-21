import test from 'node:test';
import assert from 'node:assert/strict';
import { createShipComputer } from './shipComputer.js';
import { registerShipComputerSystems } from './shipComputerSystems.js';
import { createDilithiumProcessingSystem } from '../engineering/dilithiumProcessingSystem.js';

function createHarness() {
  const position = {
    x: 10, y: 4, z: -2,
    distanceTo(other) { return Math.hypot(this.x - other.x, this.y - other.y, this.z - other.z); }
  };
  const ship = { position };
  const state = {
    speed: 42,
    fuel: 80,
    rawDilithiumOre: 8,
    refinedDilithium: 60,
    warpCoreDilithium: 60,
    dilithiumRefineryActive: false,
    warpDriveButton: false,
    warpDriveActive: false,
    warpStage: 5,
    warpCurrentStage: 0,
    warpTargetSpeed: 0,
    warpTransition: 'idle',
    warpExitMode: 'smooth',
    propulsionAuthority: 'bridge',
    shield: 91,
    hull: 98,
    throttle: true,
    braking: false
  };
  const asteroids = [
    { name: 'Contato distante', position: { x: 20, y: 4, z: -2 }, userData: { ore: 12 } },
    { name: 'Contato próximo', position: { x: 13, y: 4, z: -2 }, userData: { ore: 4 } },
    { name: 'Contato sem posição', userData: { ore: 9 } }
  ];
  let currentShip = ship;
  let pitchAngle = -0.2;
  const computer = createShipComputer();
  computer.registerTerminal({ id: 'ship-management-terminal', name: 'Terminal de gerenciamento', systems: ['navigation', 'sensors', 'power'] });
  computer.registerTerminal({ id: 'pilot-console', name: 'Console de pilotagem', systems: ['navigation', 'propulsion'] });
  computer.registerTerminal({ id: 'engineering-console', name: 'Console de Engenharia', systems: ['engineering', 'propulsion', 'power'] });
  const dilithiumProcessing = createDilithiumProcessingSystem({ state });
  registerShipComputerSystems(computer, {
    state,
    getDilithiumProcessing: () => dilithiumProcessing,
    getShip: () => currentShip,
    getShipYaw: () => 1.25,
    getPitchAngle: () => pitchAngle,
    getAsteroids: () => asteroids
  });
  computer.boot();
  computer.connectTerminal('ship-management-terminal', 'TESTE');
  computer.connectTerminal('pilot-console', 'PILOTO');
  computer.connectTerminal('engineering-console', 'ENGENHEIRO');
  return {
    computer,
    state,
    setShip(value) { currentShip = value; },
    setPitch(value) { pitchAngle = value; }
  };
}

test('navegação consulta telemetria sem alterar o estado de voo', () => {
  const { computer, state } = createHarness();
  const before = { ...state };
  const response = computer.dispatch('ship-management-terminal', 'navigation', 'telemetry');
  assert.equal(response.ok, true);
  assert.deepEqual(response.result, {
    available: true,
    position: { x: 10, y: 4, z: -2 },
    heading: 1.25,
    pitch: -0.2,
    speed: 42
  });
  assert.deepEqual(state, before);
});

test('telemetria acompanha mudanças no ângulo de arfagem', () => {
  const { computer, setPitch } = createHarness();
  setPitch(0.35);
  assert.equal(computer.dispatch('ship-management-terminal', 'navigation', 'telemetry').result.pitch, 0.35);
});

test('sensores retornam contatos válidos ordenados pela distância', () => {
  const { computer } = createHarness();
  const response = computer.dispatch('ship-management-terminal', 'sensors', 'scan');
  assert.equal(response.ok, true);
  assert.equal(response.result.totalContacts, 2);
  assert.equal(response.result.nearestContact.id, 'Contato próximo');
  assert.deepEqual(response.result.contacts.map(contact => contact.distance), [3, 10]);
});

test('energia informa reserva real de dilítio e estado da dobra', () => {
  const { computer, state } = createHarness();
  let response = computer.dispatch('ship-management-terminal', 'power', 'status');
  assert.equal(response.result.refinedDilithium, 60);
  assert.equal(response.result.warpDriveActive, false);
  state.warpDriveActive = true;
  state.warpCurrentStage = 5;
  response = computer.dispatch('ship-management-terminal', 'power', 'status');
  assert.equal(response.result.warpDriveActive, true);
  assert.equal(response.result.warpStage, 5);
});

test('controles do piloto passam pelo Ship Computer e ativam dobra no estágio 5', () => {
  const { computer, state } = createHarness();
  const response = computer.dispatch('pilot-console', 'propulsion', 'setPilotInput', {
    control: 'warpDriveButton',
    active: true
  });
  assert.equal(response.ok, true);
  assert.equal(response.result.accepted, true);
  assert.equal(state.warpDriveButton, true);
  assert.equal(state.warpStage, 5);
});

test('piloto não ativa dobra sem dilítio refinado', () => {
  const { computer, state } = createHarness();
  state.warpCoreDilithium = 0;
  const response = computer.dispatch('pilot-console', 'propulsion', 'setPilotInput', {
    control: 'warpDriveButton',
    active: true
  });
  assert.equal(response.result.accepted, false);
  assert.equal(response.result.reason, 'dilithium-unavailable');
  assert.equal(state.warpDriveButton, false);
});

test('Engenharia assume autoridade e comanda a mesma propulsão', () => {
  const { computer, state } = createHarness();
  assert.equal(computer.dispatch('engineering-console', 'engineering', 'setAuthority', { mode: 'engineering' }).result.accepted, true);
  const pilot = computer.dispatch('pilot-console', 'propulsion', 'setPilotInput', { control: 'throttle', active: true });
  assert.equal(pilot.result.accepted, false);
  assert.equal(pilot.result.reason, 'engineering-has-authority');
  const engineering = computer.dispatch('engineering-console', 'engineering', 'setInput', { control: 'warpDriveButton', active: true });
  assert.equal(engineering.result.accepted, true);
  assert.equal(state.warpDriveButton, true);
});

test('troca de autoridade não desliga uma dobra já em cruzeiro', () => {
  const { computer, state } = createHarness();
  state.warpDriveButton = true;
  state.warpDriveActive = true;
  state.warpCurrentStage = 5;
  const response = computer.dispatch('engineering-console', 'engineering', 'setAuthority', { mode: 'engineering' });
  assert.equal(response.result.accepted, true);
  assert.equal(state.warpDriveButton, true);
  assert.equal(state.warpDriveActive, true);
});

test('Engenharia seleciona os cinco estágios e define o modo de saída', () => {
  const { computer, state } = createHarness();
  const stage = computer.dispatch('engineering-console', 'engineering', 'setWarpStage', { stage: 3 });
  assert.equal(stage.result.accepted, true);
  assert.equal(state.warpStage, 3);
  const exit = computer.dispatch('engineering-console', 'engineering', 'setWarpExitMode', { mode: 'direct' });
  assert.equal(exit.result.accepted, true);
  assert.equal(state.warpExitMode, 'direct');
});

test('o piloto pode mudar estágio durante a dobra sem reiniciar a propulsão', () => {
  const { computer, state } = createHarness();
  state.warpDriveActive = true;
  state.warpDriveButton = true;
  state.warpCurrentStage = 5;
  const response = computer.dispatch('pilot-console', 'propulsion', 'setWarpStage', { stage: 2 });
  assert.equal(response.result.accepted, true);
  assert.equal(state.warpStage, 2);
  assert.equal(state.warpDriveButton, true);
});

test('autoridade automática devolve o controle à Ponte quando o piloto intervém', () => {
  const { computer, state } = createHarness();
  computer.dispatch('engineering-console', 'engineering', 'setAuthority', { mode: 'automatic' });
  const response = computer.dispatch('pilot-console', 'propulsion', 'setPilotInput', { control: 'throttle', active: true });
  assert.equal(response.result.accepted, true);
  assert.equal(state.propulsionAuthority, 'bridge');
  assert.equal(state.throttle, true);
});

test('avanço da refinaria também é executado pelo Ship Computer', () => {
  const { computer, state } = createHarness();
  computer.dispatch('engineering-console', 'engineering', 'setRefineryActive', { active: true });
  const tick = computer.tick('engineering', { dt: 1 });
  assert.equal(tick.ok, true);
  assert.equal(state.rawDilithiumOre, 7);
  assert.equal(state.refinedDilithium, 61);
});

test('console de Engenharia controla a refinaria e transfere dilítio pelo Ship Computer', () => {
  const { computer, state } = createHarness();
  const started = computer.dispatch('engineering-console', 'engineering', 'setRefineryActive', { active: true });
  assert.equal(started.result.accepted, true);
  assert.equal(state.dilithiumRefineryActive, true);
  const denied = computer.dispatch('pilot-console', 'engineering', 'transferDilithiumToCore', { amount: 10 });
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, 'access-denied');
  const transfer = computer.dispatch('engineering-console', 'engineering', 'transferDilithiumToCore', { amount: 10 });
  assert.equal(transfer.result.accepted, true);
  assert.equal(transfer.result.transferred, 10);
  assert.equal(state.refinedDilithium, 50);
  assert.equal(state.warpCoreDilithium, 70);
});

test('subsistemas sinalizam indisponibilidade quando a nave não existe', () => {
  const { computer, setShip } = createHarness();
  setShip(null);
  assert.deepEqual(computer.dispatch('ship-management-terminal', 'navigation', 'telemetry').result, { available: false });
  assert.deepEqual(computer.dispatch('ship-management-terminal', 'sensors', 'scan').result, {
    available: false, totalContacts: 0, nearestContact: null, contacts: []
  });
  assert.deepEqual(computer.dispatch('ship-management-terminal', 'power', 'status').result, { available: false });
  assert.equal(computer.dispatch('engineering-console', 'engineering', 'status').result.available, false);
});
