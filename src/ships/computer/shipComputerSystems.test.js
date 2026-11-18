import test from 'node:test';
import assert from 'node:assert/strict';
import { createShipComputer } from './shipComputer.js';
import { registerShipComputerSystems } from './shipComputerSystems.js';

function createHarness() {
  const position = {
    x: 10,
    y: 4,
    z: -2,
    distanceTo(other) {
      return Math.hypot(this.x - other.x, this.y - other.y, this.z - other.z);
    }
  };
  const ship = { position };
  const state = {
    speed: 42,
    camera: 0,
    fuel: 80,
    nitro: 35,
    shield: 91,
    hull: 98,
    throttle: true,
    braking: false,
    nitroButton: false
  };
  const asteroids = [
    { name: 'Contato distante', position: { x: 20, y: 4, z: -2 }, userData: { ore: 12 } },
    { name: 'Contato próximo', position: { x: 13, y: 4, z: -2 }, userData: { ore: 4 } },
    { name: 'Contato sem posição', userData: { ore: 9 } }
  ];
  let currentShip = ship;
  const computer = createShipComputer();

  computer.registerTerminal({
    id: 'pilot-console',
    name: 'Console de pilotagem',
    systems: ['navigation', 'sensors', 'power']
  });
  registerShipComputerSystems(computer, {
    state,
    getShip: () => currentShip,
    getShipYaw: () => 1.25,
    getPitchAngle: () => -0.2,
    getAsteroids: () => asteroids
  });
  computer.boot();
  assert.equal(computer.connectTerminal('pilot-console', 'TESTE'), true);

  return {
    computer,
    state,
    setShip(value) { currentShip = value; }
  };
}

test('navegação consulta a telemetria atual sem alterar o estado de voo', () => {
  const { computer, state } = createHarness();
  const before = { ...state };

  const response = computer.dispatch('pilot-console', 'navigation', 'telemetry');

  assert.equal(response.ok, true);
  assert.deepEqual(response.result, {
    available: true,
    position: { x: 10, y: 4, z: -2 },
    heading: 1.25,
    pitch: -0.2,
    speed: 42,
    cameraMode: 0
  });
  assert.deepEqual(state, before);
});

test('sensores retornam contatos válidos ordenados pela distância', () => {
  const { computer } = createHarness();

  const response = computer.dispatch('pilot-console', 'sensors', 'scan');

  assert.equal(response.ok, true);
  assert.equal(response.result.totalContacts, 2);
  assert.equal(response.result.nearestContact.id, 'Contato próximo');
  assert.deepEqual(response.result.contacts.map(contact => contact.distance), [3, 10]);
});

test('energia reflete os limites reais de combustível, nitro e propulsão', () => {
  const { computer, state } = createHarness();

  let response = computer.dispatch('pilot-console', 'power', 'status');
  assert.equal(response.result.propulsion, 'thrust');
  assert.equal(response.result.fuel, 80);

  state.nitroButton = true;
  response = computer.dispatch('pilot-console', 'power', 'status');
  assert.equal(response.result.propulsion, 'boost');

  state.fuel = 0;
  response = computer.dispatch('pilot-console', 'power', 'status');
  assert.equal(response.result.propulsion, 'idle');
});

test('os três subsistemas sinalizam indisponibilidade quando a nave não existe', () => {
  const { computer, setShip } = createHarness();
  setShip(null);

  assert.deepEqual(
    computer.dispatch('pilot-console', 'navigation', 'telemetry').result,
    { available: false }
  );
  assert.deepEqual(
    computer.dispatch('pilot-console', 'sensors', 'scan').result,
    { available: false, totalContacts: 0, nearestContact: null, contacts: [] }
  );
  assert.deepEqual(
    computer.dispatch('pilot-console', 'power', 'status').result,
    { available: false }
  );

  const statuses = Object.fromEntries(
    computer.getSnapshot().systems.map(system => [system.id, system.status])
  );
  assert.equal(statuses.navigation, 'standby');
  assert.equal(statuses.sensors, 'standby');
  assert.equal(statuses.power, 'standby');
});
