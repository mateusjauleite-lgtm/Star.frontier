import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeflectorRuntimeSystem } from './deflectorRuntimeSystem.js';

test('Runtime atualiza núcleo e ramificações em sequência e publica telemetria', () => {
  const state = { refinedDilithium: 1, deflectorCoreEnergy: 0 };
  const runtime = createDeflectorRuntimeSystem({
    state,
    core: { chargeRate: 2 },
    emitter: { energyPerSecond: 1 },
    sensors: { energyPerSecond: 0.5 },
    persist: () => {}
  });

  runtime.initialize();
  const telemetry = runtime.update(0.1);

  assert.equal(telemetry.transferAmount, 0.2);
  assert.equal(telemetry.emitter.active, true);
  assert.equal(telemetry.sensors.operational, true);
  assert.equal(telemetry.branches.length, 2);
  assert.equal(state.deflectorCoreTelemetry, telemetry);
  assert.ok(state.deflectorCoreEnergy < 0.2);
});

test('consumo simultâneo respeita reserva local e interrompe a ramificação sem energia', () => {
  const state = { refinedDilithium: 0, deflectorCoreEnergy: 0.1 };
  const runtime = createDeflectorRuntimeSystem({
    state,
    emitter: { energyPerSecond: 1.8 },
    sensors: { energyPerSecond: 0.65 },
    persist: () => {}
  });

  runtime.initialize();
  const telemetry = runtime.update(0.1);

  assert.equal(state.deflectorCoreEnergy, 0);
  assert.equal(telemetry.emitter.active, true);
  assert.equal(telemetry.sensors.operational, false);
  assert.ok(telemetry.consumedTotal > 0);
  assert.equal(telemetry.branches.reduce((sum, branch) => sum + branch.consumptionRate, 0), telemetry.consumptionRate);
});

test('Runtime persiste o estado após o intervalo de autosave e no encerramento', () => {
  let saves = 0;
  const state = { refinedDilithium: 0, deflectorCoreEnergy: 5 };
  const runtime = createDeflectorRuntimeSystem({ state, persist: () => { saves += 1; } });
  runtime.initialize();
  runtime.update(2.5);
  assert.equal(saves, 0);
  runtime.update(2.5);
  assert.equal(saves, 1);
  runtime.shutdown();
  assert.equal(saves, 2);
});
