import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeflectorCoreSystem } from './deflectorCoreSystem.js';

function setup(overrides = {}, options = {}) {
  const state = { refinedDilithium: 20, deflectorCoreEnergy: 0, ...overrides };
  return { state, core: createDeflectorCoreSystem(state, options) };
}

test('núcleo transfere energia da reserva principal usando o dt real', () => {
  const { state, core } = setup({}, { chargeRate: 1 });
  const status = core.update(0.25);
  assert.equal(state.deflectorCoreEnergy, 0.25);
  assert.equal(state.refinedDilithium, 19.75);
  assert.equal(status.transferAmount, 0.25);
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
  core.setChargingEnabled(false);
  core.update(0.1);
  const result = core.consumeEnergy('test-branch', 0.4, 0.1);
  assert.equal(result.consumed, 0.4);
  assert.equal(state.deflectorCoreEnergy, 1.6);
  assert.equal(state.refinedDilithium, 20);
});

test('limite de consumo respeita o dt real e não pode ser contornado por chamadas repetidas', () => {
  const { core } = setup({ deflectorCoreEnergy: 5 });
  core.registerBranch('test-branch', { maxDrawPerSecond: 2 });
  core.update(0.25);
  const first = core.consumeEnergy('test-branch', 0.4, 0.25);
  const second = core.consumeEnergy('test-branch', 0.4, 0.25);
  assert.equal(first.consumed, 0.4);
  assert.equal(second.consumed, 0.1);
  assert.equal(second.accepted, false);
});

test('núcleo desligado bloqueia consumo das ramificações', () => {
  const { state, core } = setup({ deflectorCoreEnergy: 2 });
  core.registerBranch('test-branch');
  core.update(0);
  core.setEnabled(false);
  assert.equal(core.consumeEnergy('test-branch', 0.2, 0.1).consumed, 0);
  assert.equal(state.deflectorCoreEnergy, 2);
});

test('núcleo vazio bloqueia ramificações e não produz energia', () => {
  const { state, core } = setup({ refinedDilithium: 0, deflectorCoreEnergy: 0 });
  core.registerBranch('test-branch');
  core.update(0.5);
  const result = core.consumeEnergy('test-branch', 0.1, 0.5);
  assert.equal(result.consumed, 0);
  assert.equal(result.accepted, false);
  assert.equal(state.deflectorCoreEnergy, 0);
});

test('consumo de várias ramificações nunca ultrapassa a reserva local', () => {
  const { state, core } = setup({ refinedDilithium: 0, deflectorCoreEnergy: 0.15 });
  core.registerBranch('emitter', { maxDrawPerSecond: 2 });
  core.registerBranch('sensors', { maxDrawPerSecond: 1 });
  core.update(0.1);
  const emitter = core.consumeEnergy('emitter', 0.2, 0.1);
  const sensors = core.consumeEnergy('sensors', 0.1, 0.1);
  assert.equal(emitter.consumed, 0.15);
  assert.equal(sensors.consumed, 0);
  assert.equal(state.deflectorCoreEnergy, 0);
});

test('núcleo não recarrega além da energia disponível na reserva principal', () => {
  const { state, core } = setup({ refinedDilithium: 0.03 }, { chargeRate: 2 });
  const status = core.update(0.5);
  assert.equal(status.transferAmount, 0.03);
  assert.equal(state.refinedDilithium, 0);
  assert.equal(state.deflectorCoreEnergy, 0.03);
});
