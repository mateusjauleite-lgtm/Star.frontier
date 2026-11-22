import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeflectorCoreSystem } from './deflectorCoreSystem.js';
import { createDeflectorEmitterSystem } from './deflectorEmitterSystem.js';

test('emissor frontal ativa com energia e consome a reserva local', () => {
  const state = { refinedDilithium: 0, deflectorCoreEnergy: 5 };
  const core = createDeflectorCoreSystem(state);
  const emitter = createDeflectorEmitterSystem(core, { energyPerSecond: 1, enabled: true });
  const status = emitter.update(0.1);
  assert.equal(status.active, true);
  assert.equal(status.fieldStrength, 1);
  assert.equal(state.deflectorCoreEnergy, 4.9);
});

test('emissor pode ser desligado independentemente do núcleo', () => {
  const state = { refinedDilithium: 0, deflectorCoreEnergy: 5 };
  const core = createDeflectorCoreSystem(state);
  const emitter = createDeflectorEmitterSystem(core);
  emitter.setEnabled(false);
  assert.equal(emitter.update(0.1).active, false);
  assert.equal(state.deflectorCoreEnergy, 5);
});
