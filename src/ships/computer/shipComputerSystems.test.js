import test from 'node:test';
import assert from 'node:assert/strict';
import { createShipComputer } from './shipComputer.js';
import { registerShipComputerSystems } from './shipComputerSystems.js';
import { createDilithiumRefinerySystem } from '../systems/dilithiumRefinerySystem.js';
import { RESOURCE_IDS } from '../../core/resources/resourceCatalog.js';

function createHarness() {
  const position = {
    x: 10, y: 4, z: -2,
    distanceTo(other) { return Math.hypot(this.x - other.x, this.y - other.y, this.z - other.z); }
  };
  const ship = { position };
  const state = {
    speed: 42,
    fuel: 80,
    refinedDilithium: 60,
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
    { name: 'Contato próximo', position: { x: 13, y: 4, z: -2 }, userData: { ore: 4, resources: { [RESOURCE_IDS.DILITHIUM_ORE]: { amount: 7, purity: 0.88 } } } },
    { name: 'Contato sem posição', userData: { ore: 9 } }
  ];
  let currentShip = ship;
  let pitchAngle = -0.2;
  const computer = createShipComputer();
  Object.assign(state, { rawDilithiumOre: 12, refineryRefinedStorage: 3, refineryEnabled: true, refineryTransferEnabled: false, refineryRefinedTotal: 0, refineryTransferredTotal: 0 });
  state.warpDilithiumConsumedTotal = 4.5;
  const refinerySystem = createDilithiumRefinerySystem(state);
  computer.registerTerminal({ id: 'ship-management-terminal', name: 'Terminal de gerenciamento', systems: ['navigation', 'sensors', 'engineering', 'power'] });
  computer.registerTerminal({ id: 'pilot-console', name: 'Console de pilotagem', systems: ['navigation', 'propulsion'] });
  computer.registerTerminal({ id: 'refinery-console', name: 'Console da Refinaria', systems: ['refinery'] });
  computer.registerTerminal({ id: 'engineering-console', name: 'Console de Engenharia', systems: ['engineering', 'propulsion', 'power'] });
  registerShipComputerSystems(computer, {
    state,
    getShip: () => currentShip,
    getShipYaw: () => 1.25,
    getPitchAngle: () => pitchAngle,
    getAsteroids: () => asteroids,
    refinerySystem
  });
  computer.boot();
  computer.connectTerminal('ship-management-terminal', 'TESTE');
  computer.connectTerminal('pilot-console', 'PILOTO');
  computer.connectTerminal('engineering-console', 'ENGENHEIRO');
  computer.connectTerminal('refinery-console', 'ENGENHEIRO DE RECURSOS');
  return {
    computer,
    state,
    refinerySystem,
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
  assert.deepEqual(response.result.resourceIds, [RESOURCE_IDS.DILITHIUM_ORE]);
  assert.deepEqual(response.result.nearestContact.resources, [{ resourceId: RESOURCE_IDS.DILITHIUM_ORE, amount: 7, purity: 0.88 }]);
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
  const centralTelemetry = computer.dispatch('ship-management-terminal', 'engineering', 'status');
  assert.equal(centralTelemetry.ok, true);
  assert.equal('refinery' in centralTelemetry.result, false);
  const powerTelemetry = computer.dispatch('ship-management-terminal', 'power', 'status');
  assert.equal(powerTelemetry.result.refinery.available, true);
  assert.equal(powerTelemetry.result.refinery.refinedBuffer, 3);
});

test('aplicativo do núcleo informa reserva, estágio e taxa real de consumo', () => {
  const { computer, state } = createHarness();
  state.warpDriveActive = true;
  state.warpCurrentStage = 5;
  const response = computer.dispatch('ship-management-terminal', 'power', 'status');
  assert.equal(response.ok, true);
  assert.equal(response.result.warpCore.reserve, state.refinedDilithium);
  assert.equal(response.result.warpCore.stage, 5);
  assert.equal(response.result.warpCore.active, true);
  assert.equal(response.result.warpCore.consumptionRate, 0.045);
  assert.equal(response.result.warpCore.consumedTotal, 4.5);
  assert.equal(response.result.warpCore.conventionalFuelConsumptionRate, 0);
  assert.equal(computer.dispatch('engineering-console', 'power', 'status').ok, true);
  assert.equal(computer.dispatch('pilot-console', 'power', 'status').reason, 'access-denied');
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
  state.refinedDilithium = 0;
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


test('somente o terminal próprio controla a Refinaria', () => {
  const { computer, refinerySystem } = createHarness();
  const local = computer.dispatch('refinery-console', 'refinery', 'setTransferEnabled', { enabled: true });
  assert.equal(local.result.accepted, true);
  assert.equal(refinerySystem.snapshot().transferEnabled, true);
  assert.equal(computer.dispatch('ship-management-terminal', 'refinery', 'status').reason, 'access-denied');
  assert.equal(computer.dispatch('engineering-console', 'refinery', 'status').reason, 'access-denied');
});

test('Refinaria fica acessível apenas pelo terminal próprio',()=>{const {computer}=createHarness();assert.equal(computer.dispatch('refinery-console','refinery','status').result.rawOre,12);assert.equal(computer.dispatch('ship-management-terminal','refinery','status').reason,'access-denied');assert.equal(computer.dispatch('engineering-console','refinery','status').reason,'access-denied');assert.equal(computer.dispatch('refinery-console','refinery','setRefineryEnabled',{enabled:false}).result.accepted,true);});


test('gerenciamento transfere dilítio refinado para o reservatório usado pela dobra',()=>{const {computer,state,refinerySystem}=createHarness();const r=computer.dispatch('ship-management-terminal','power','transferRefinedDilithium',{amount:2.5});assert.equal(r.ok,true);assert.equal(r.result.accepted,true);assert.equal(r.result.transferred,2.5);assert.equal(state.refineryRefinedStorage,.5);assert.equal(state.refinedDilithium,62.5);assert.equal(refinerySystem.snapshot().coreDilithium,62.5);});
test('somente gerenciamento da ponte pode comandar transferência manual',()=>{const {computer,state}=createHarness();const r=computer.dispatch('engineering-console','power','transferRefinedDilithium',{amount:1});assert.equal(r.ok,true);assert.equal(r.result.accepted,false);assert.equal(r.result.reason,'management-terminal-required');assert.equal(state.refinedDilithium,60);assert.equal(state.refineryRefinedStorage,3);});
test('transferência do gerenciamento não converte minério bruto em combustível',()=>{const {computer,state}=createHarness();computer.dispatch('ship-management-terminal','power','transferRefinedDilithium',{amount:1});assert.equal(state.rawDilithiumOre,12);assert.equal(state.refineryRefinedStorage,2);assert.equal(state.refinedDilithium,61);});
