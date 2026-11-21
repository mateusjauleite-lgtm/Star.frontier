import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameplayRuntimeSystem } from './gameplaySystem.js';

function createPhases(log) {
  return Object.fromEntries([
    'updateEnvironment',
    'updateCharacterMode',
    'updateLanding',
    'updateWorld',
    'render',
    'updateHud'
  ].map(name => [name, dt => log.push([name, dt])]));
}

test('gameplay runtime owns the deterministic frame update sequence', () => {
  const log = [];
  const system = createGameplayRuntimeSystem({
    ...createPhases(log),
    isActive: () => true,
    isRendererReady: () => true
  });

  assert.equal(system.priority, 40);
  assert.equal(system.update(0.016), true);
  assert.deepEqual(log.map(([name]) => name), [
    'updateEnvironment', 'updateCharacterMode', 'updateLanding',
    'updateWorld', 'render', 'updateHud'
  ]);
  assert.ok(log.every(([, dt]) => dt === 0.016));
});

test('gameplay runtime skips every phase while inactive or before renderer readiness', () => {
  const log = [];
  const phases = createPhases(log);
  const inactive = createGameplayRuntimeSystem({
    ...phases, isActive: () => false, isRendererReady: () => true
  });
  const notReady = createGameplayRuntimeSystem({
    ...phases, isActive: () => true, isRendererReady: () => false
  });

  assert.equal(inactive.update(0.016), false);
  assert.equal(notReady.update(0.016), false);
  assert.deepEqual(log, []);
});

test('gameplay runtime rejects missing phases during registration', () => {
  assert.throws(() => createGameplayRuntimeSystem({}), /fase de gameplay/);
});
