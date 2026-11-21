import test from 'node:test';
import assert from 'node:assert/strict';
import { createDilithiumRefinerySystem } from './dilithiumRefinerySystem.js';

function setup(overrides = {}, options = {}) {
  const state = {
    rawDilithiumOre: 10,
    refineryRefinedStorage: 0,
    refinedDilithium: 20,
    refineryEnabled: true,
    refineryTransferEnabled: false,
    ...overrides
  };
  return { state, system: createDilithiumRefinerySystem(state, options) };
}

test('refinaria converte minério bruto em reserva refinada sem alimentar o núcleo automaticamente', () => {
  const { state, system } = setup({}, { refiningRate: 1 });
  system.update(0.1);
  assert.equal(state.rawDilithiumOre, 9.9);
  assert.equal(state.refineryRefinedStorage, 0.1);
  assert.equal(state.refinedDilithium, 20);
});

test('transferência alimenta o núcleo e atualiza o total transferido', () => {
  const { state, system } = setup({ rawDilithiumOre: 0, refineryRefinedStorage: 5, refineryTransferEnabled: true }, { transferRate: 2 });
  const status = system.update(0.1);
  assert.equal(state.refinedDilithium, 20.2);
  assert.equal(state.refineryRefinedStorage, 4.8);
  assert.equal(status.transferredTotal, 0.2);
  assert.equal(status.transferRate, 2);
});

test('núcleo respeita capacidade e interrompe transferência quando cheio', () => {
  const { state, system } = setup({ rawDilithiumOre: 0, refinedDilithium: 249.9, refineryRefinedStorage: 5, refineryTransferEnabled: true }, { transferRate: 2 });
  const status = system.update(0.1);
  assert.equal(state.refinedDilithium, 250);
  assert.ok(Math.abs(state.refineryRefinedStorage - 4.9) < 1e-9);
  assert.equal(status.coreRemainingCapacity, 0);
});

test('desligar refinaria interrompe processamento e transferência', () => {
  const { state, system } = setup({ refineryRefinedStorage: 5, refineryTransferEnabled: true, refineryEnabled: false });
  system.update(0.1);
  assert.equal(state.rawDilithiumOre, 10);
  assert.equal(state.refineryRefinedStorage, 5);
  assert.equal(state.refinedDilithium, 20);
});

test('consumo externo do núcleo é contabilizado separadamente da transferência', () => {
  const { state, system } = setup();
  system.update(0.1);
  state.refinedDilithium -= 1;
  const status = system.update(0.1);
  assert.equal(status.consumedTotal, 1);
  assert.equal(status.consumptionRate, 10);
});
