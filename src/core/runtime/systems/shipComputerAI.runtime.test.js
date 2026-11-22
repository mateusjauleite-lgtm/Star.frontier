import test from 'node:test';
import assert from 'node:assert/strict';
import { createShipComputerRuntimeSystem } from './shipComputerSystem.js';

test('Runtime supervisiona a IA e executa rondas periódicas sem executar ações corretivas', () => {
  const calls = [];
  const ai = {
    runPatrol() { calls.push('patrol'); return { ok: true }; },
    stopVoiceRecognition() { calls.push('voice-stop'); }
  };
  const computer = createShipComputerRuntimeSystem({
    registerSystems() { calls.push('register'); },
    boot() { calls.push('boot'); },
    onboardAI: ai,
    shutdown() { calls.push('shutdown'); },
    patrolIntervalSeconds: 5
  });
  const context = {};
  computer.initialize(context);
  assert.equal(context.shipComputerAI, ai);
  computer.update(2);
  computer.update(2);
  assert.deepEqual(calls, ['register', 'boot']);
  computer.update(1);
  assert.deepEqual(calls, ['register', 'boot', 'patrol']);
  computer.update(1);\n  computer.update(1);\n  computer.update(1);\n  computer.update(1);\n  computer.update(1);
  assert.deepEqual(calls, ['register', 'boot', 'patrol', 'patrol', 'patrol']);
  computer.shutdown(context);
  assert.equal('shipComputerAI' in context, false);
  assert.deepEqual(calls.slice(-2), ['voice-stop', 'shutdown']);
});
