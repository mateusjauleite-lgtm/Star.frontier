import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeBridge } from './RuntimeBridge.js';

function createFakeKernel(maximumDeltaSeconds = 0.04) {
  let status = 'created';
  let frameCount = 0;
  let elapsedSeconds = 0;
  return {
    get status() { return status; },
    get frameCount() { return frameCount; },
    get elapsedSeconds() { return elapsedSeconds; },
    initialize() {
      if (status !== 'created' && status !== 'stopped') return false;
      status = 'ready';
      frameCount = 0;
      elapsedSeconds = 0;
      return true;
    },
    start() { if (status !== 'ready') return false; status = 'running'; return true; },
    pause() { if (status !== 'running') return false; status = 'paused'; return true; },
    resume() { if (status !== 'paused') return false; status = 'running'; return true; },
    stop() { status = 'stopped'; return true; },
    tick(deltaSeconds) {
      if (status !== 'running' || !Number.isFinite(deltaSeconds) || deltaSeconds < 0) return 0;
      const safeDelta = Math.min(deltaSeconds, maximumDeltaSeconds);
      frameCount += 1;
      elapsedSeconds += safeDelta;
      return safeDelta;
    },
    dispose() { status = 'disposed'; }
  };
}

test('RuntimeBridge initializes systems by priority and updates them in order', async () => {
  const kernel = createFakeKernel();
  const bridge = createRuntimeBridge(kernel);
  const calls = [];

  bridge.registerSystem('visuals', {
    priority: 20,
    initialize: () => calls.push('visuals:init'),
    update: dt => calls.push('visuals:update:' + dt.toFixed(2)),
    shutdown: () => calls.push('visuals:stop')
  });
  bridge.registerSystem('simulation', {
    priority: 10,
    initialize: () => calls.push('simulation:init'),
    update: dt => calls.push('simulation:update:' + dt.toFixed(2)),
    shutdown: () => calls.push('simulation:stop')
  });

  assert.equal(await bridge.initialize({ session: 'test' }), true);
  assert.equal(bridge.start(), true);
  assert.equal(bridge.update(0.2), 0.04);
  await bridge.shutdown();

  assert.deepEqual(calls, [
    'simulation:init',
    'visuals:init',
    'simulation:update:0.04',
    'visuals:update:0.04',
    'visuals:stop',
    'simulation:stop'
  ]);
  assert.equal(kernel.status, 'stopped');
});

test('RuntimeBridge does not update while paused', async () => {
  const bridge = createRuntimeBridge(createFakeKernel());
  let updates = 0;
  bridge.registerSystem('counter', { update: () => updates++ });
  await bridge.initialize();
  bridge.start();
  bridge.pause();

  assert.equal(bridge.update(0.016), 0);
  assert.equal(updates, 0);
  assert.equal(bridge.resume(), true);
  assert.equal(bridge.update(0.016), 0.016);
  assert.equal(updates, 1);
});

test('RuntimeBridge rejects duplicate names and registration after initialization', async () => {
  const bridge = createRuntimeBridge(createFakeKernel());
  bridge.registerSystem('world');
  assert.throws(() => bridge.registerSystem('world'), /já registrado/);
  await bridge.initialize();
  assert.throws(() => bridge.registerSystem('late-system'), /antes da inicialização/);
});

test('RuntimeBridge shuts down already initialized systems if initialization fails', async () => {
  const bridge = createRuntimeBridge(createFakeKernel());
  const calls = [];
  bridge.registerSystem('first', { initialize: () => calls.push('first:init'), shutdown: () => calls.push('first:stop') });
  bridge.registerSystem('second', { initialize: () => { throw new Error('failure'); } });

  await assert.rejects(() => bridge.initialize(), /failure/);
  assert.deepEqual(calls, ['first:init', 'first:stop']);
  assert.equal(bridge.status, 'stopped');
});
