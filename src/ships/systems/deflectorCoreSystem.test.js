import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeflectorCoreSystem } from './deflectorCoreSystem.js';

function setup(overrides = {}, options = {}) {
  const state = { refinedDilithium: 20, deflectorCoreEnergy: 0, ...overrides };
  return { state, core: createDeflectorCoreSystem(state, options) };
}

test('núcleo transfere energia da reserva principal para sua reserva independente', () => {
  const { state, core } = setup({}, { chargeRate: 1 });
  const status = core.update(0.1);
  assert.equal(state.deflectorCoreEnergy, 0.1);
  assert.equal(state.refinedDilithium, 19.9);
  assert.equal(status.energy, 0.1);
  assert.equal(status.transferRate, 1);
});

test('núcleo respeita capacidade e não retira energia excedente da reserva principal', () => {
  const { state, core } = setup({ deflectorCoreEnergy: 9.95 }, { capacity: 10, chargeRate: 5 });
  core.update(0.1);
  assert.equal(state.deflectorCoreEnergy, 10);
  assert.ok(Math.abs(state.refinedDilithium - 19.95) < 1e-9);
});

test('desligar carregamento preserva a reserva local', () => {
  const { state, core } = setup();
  core.setChargingEnabled(false);
  core.update(0.1);
  assert.equal(state.refinedDilithium, 20);
  assert.equal(state.deflectorCoreEnergy, 0);
});

test('ramificações consomem a reserva local sem acessar diretamente a reserva principal', () => {
  const { state, core } = setup({ deflectorCoreEnergy: 2 });
  core.registerBranch('test-branch', { maxDrawPerSecond: 5 });
  const result = core.consumeEnergy('test-branch', 0.4);
  assert.equal(result.consumed, 0.4);
  assert.equal(state.deflectorCoreEnergy, 1.6);
  assert.equal(state.refinedDilithium, 20);
});

test('núcleo desligado bloqueia consumo das ramificações', () => {
  const { state, core } = setup({ deflectorCoreEnergy: 2 });
  core.registerBranch('test-branch');
  core.setEnabled(false);
  assert.equal(core.consumeEnergy('test-branch', 0.2).consumed, 0);
  assert.equal(state.deflectorCoreEnergy, 2);
});

test('limita a taxa máxima de retirada por ramificação em cada atualização', () => {
  const { core } = setup({ deflectorCoreEnergy: 5 });
  core.registerBranch('test-branch', { maxDrawPerSecond: 1 });
  const result = core.consumeEnergy('test-branch', 0.5);
  assert.equal(result.consumed, 0.1);
  assert.equal(result.accepted, false);
});
