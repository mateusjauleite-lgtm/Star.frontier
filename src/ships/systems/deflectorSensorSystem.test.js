import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeflectorCoreSystem } from './deflectorCoreSystem.js';
import { createDeflectorSensorSystem } from './deflectorSensorSystem.js';

test('sensores ficam operacionais quando recebem energia suficiente', () => {
  const state = { refinedDilithium: 0, deflectorCoreEnergy: 5 };
  const core = createDeflectorCoreSystem(state);
  const sensors = createDeflectorSensorSystem(core, { energyPerSecond: 0.5, enabled: true });
  const status = sensors.update(0.1);
  assert.equal(status.operational, true);
  assert.equal(status.signalQuality, 1);
  assert.equal(state.deflectorCoreEnergy, 4.95);
});

test('sensores perdem disponibilidade quando a reserva não atende ao consumo', () => {
  const state = { refinedDilithium: 0, deflectorCoreEnergy: 0.01 };
  const core = createDeflectorCoreSystem(state);
  const sensors = createDeflectorSensorSystem(core, { energyPerSecond: 1, enabled: true });
  const status = sensors.update(0.1);
  assert.equal(status.operational, false);
  assert.ok(status.signalQuality > 0);
});
