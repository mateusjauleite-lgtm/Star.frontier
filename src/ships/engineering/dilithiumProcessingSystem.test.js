import test from 'node:test';
import assert from 'node:assert/strict';
import { createDilithiumProcessingSystem, DILITHIUM_COMPONENT_IDS, DILITHIUM_RECOGNITION_PRIORITY } from './dilithiumProcessingSystem.js';

function createHarness(overrides = {}) {
  const state = { rawDilithiumOre: 0, refinedDilithium: 0, warpCoreDilithium: 0, dilithiumRefineryActive: false, ...overrides };
  return { state, system: createDilithiumProcessingSystem({ state }) };
}

test('IDs e prioridade de reconhecimento permanecem estáveis', () => {
  assert.equal(DILITHIUM_COMPONENT_IDS.RAW_STORAGE, 'storage:raw-dilithium');
  assert.equal(DILITHIUM_COMPONENT_IDS.REFINERY, 'machine:dilithium-refinery');
  assert.equal(DILITHIUM_COMPONENT_IDS.REFINED_STORAGE, 'storage:refined-dilithium');
  assert.equal(DILITHIUM_COMPONENT_IDS.WARP_CORE, 'system:warp-core');
  assert.deepEqual(DILITHIUM_RECOGNITION_PRIORITY, [DILITHIUM_COMPONENT_IDS.WARP_CORE, DILITHIUM_COMPONENT_IDS.REFINERY, DILITHIUM_COMPONENT_IDS.REFINED_STORAGE, DILITHIUM_COMPONENT_IDS.RAW_STORAGE]);
});

test('refinaria exige minério e converte um por segundo', () => {
  const { state, system } = createHarness({ rawDilithiumOre: 3 });
  assert.equal(system.setRefineryActive(true).accepted, true);
  system.update(1);
  assert.equal(state.rawDilithiumOre, 2);
  assert.equal(state.refinedDilithium, 1);
});

test('refinaria para quando o armazenamento refinado fica cheio', () => {
  const { state, system } = createHarness({ rawDilithiumOre: 3, refinedDilithium: 500 });
  assert.equal(system.setRefineryActive(true).reason, 'refined-storage-full');
  assert.equal(state.rawDilithiumOre, 3);
});

test('transferência move material do armazenamento refinado para o núcleo', () => {
  const { state, system } = createHarness({ refinedDilithium: 80 });
  const result = system.transferToCore({ amount: 25 });
  assert.equal(result.transferred, 25);
  assert.equal(state.refinedDilithium, 55);
  assert.equal(state.warpCoreDilithium, 25);
});

test('reserva já transferida permanece no núcleo após esvaziar o armazenamento', () => {
  const { state, system } = createHarness({ refinedDilithium: 12 });
  system.transferToCore({ amount: 12 });
  assert.equal(state.refinedDilithium, 0);
  assert.equal(state.warpCoreDilithium, 12);
});
