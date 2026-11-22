import test from 'node:test';
import assert from 'node:assert/strict';
import { createWarpCorePowerSystem } from './warpCorePowerSystem.js';

test('núcleo gera saída regulada e distribui buffers isolados', () => {
  const state = { refinedDilithium: 20 };
  const core = createWarpCorePowerSystem({ state });
  core.initialize();
  const status = core.update(1);
  assert.equal(status.phase, 'idle');
  assert.equal(status.outputPerSecond, 16);
  assert.ok(status.buses.critical.energy > 0);
  assert.ok(status.buses.operations.energy > 0);
  assert.ok(status.buses.warp.energy > 0);
  assert.equal(state.refinedDilithium, 20);
});

test('barramento de dobra não consegue consumir a reserva crítica', () => {
  const state = { refinedDilithium: 20 };
  const core = createWarpCorePowerSystem({ state });
  core.update(1);
  const criticalBefore = core.snapshot().buses.critical.energy;
  const delivered = core.powerBus.draw(100, 10);
  assert.ok(delivered > 0);
  assert.equal(core.snapshot().buses.critical.energy, criticalBefore);
  assert.equal(core.snapshot().buses.warp.energy, 0);
});

test('matriz bloqueia geração se dilítio refinado não estiver disponível', () => {
  const state = { refinedDilithium: 0 };
  const core = createWarpCorePowerSystem({ state });
  const status = core.update(1);
  assert.equal(status.phase, 'dilithium-unavailable');
  assert.equal(status.generatedThisFrame, 0);
});

test('contenção instável e matriz desligada interrompem geração com segurança', () => {
  const state = { refinedDilithium: 10, warpCoreContainmentStable: false };
  const core = createWarpCorePowerSystem({ state });
  assert.equal(core.update(1).generatedThisFrame, 0);
  core.setContainmentStable(true);
  core.setMatrixEnabled(false);
  assert.equal(core.update(1).generatedThisFrame, 0);
});

test('a matriz limita a saída sem converter estoque enquanto o plasma está acima do limiar', () => {
  const state = { refinedDilithium: 5, warpCoreMatrixRegulation: 0.5 };
  const core = createWarpCorePowerSystem({ state });
  const status = core.update(1);
  assert.equal(status.outputPerSecond, 8);
  assert.equal(state.refinedDilithium, 5);
});

test('fonte de reação externa pode limitar a potência solicitada', () => {
  const state = { refinedDilithium: 5 };
  const core = createWarpCorePowerSystem({
    state,
    reactionSource: { produce: requested => requested * 0.25 }
  });
  assert.equal(core.update(1).outputPerSecond, 4);
});


test('matriz converte dilítio refinado da reserva em plasma estabilizado', () => {
  const state = { refinedDilithium: 5, plasma: 0, plasmaCapacity: 250 };
  const core = createWarpCorePowerSystem({ state });
  const status = core.update(1);
  assert.ok(Math.abs(state.matrixDilithiumConsumedTotal - 0.18) < 1e-12);
  assert.ok(Math.abs(state.plasmaProducedTotal - 0.18) < 1e-12);
  assert.ok(Math.abs(state.plasmaConsumedTotal - 0.04) < 1e-12);
  assert.ok(Math.abs(state.refinedDilithium - 4.82) < 1e-12);
  assert.ok(Math.abs(state.plasma - 0.14) < 1e-12);
  assert.equal(status.outputPerSecond, 16);
});
