import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioMicrophoneRuntimeSystem } from './audioMicrophoneSystem.js';

test('Runtime injeta o mesmo Audio Manager e inspeciona permissões sem abrir captura', async () => {
  const calls = [];
  const manager = {
    initialize: async () => calls.push('initialize'),
    getSnapshot: () => ({ microphone: { active: false, permission: 'prompt' } }),
    stopMicrophone: () => calls.push('stop')
  };
  const system = createAudioMicrophoneRuntimeSystem(manager);
  const context = {};
  await system.initialize(context);
  assert.equal(context.audioManager, manager);
  assert.equal(context.audioSnapshot.microphone.permission, 'prompt');
  assert.deepEqual(calls, ['initialize']);
  system.update(0.016, context);
  assert.equal(context.audioSnapshot.microphone.active, false);
  system.shutdown(context);
  assert.equal(context.audioManager, undefined);
  assert.equal(context.audioSnapshot, undefined);
  assert.deepEqual(calls, ['initialize', 'stop']);
});

test('Runtime exige o contrato mínimo do Audio Manager', () => {
  assert.throws(
    () => createAudioMicrophoneRuntimeSystem({}),
    /não implementa o contrato esperado/
  );
});
