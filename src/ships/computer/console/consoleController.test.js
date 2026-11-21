import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createShipConsoleController,
  createShipConsoleRuntimeSystem
} from './consoleController.js';

function createHarness() {
  let connected = false;
  let listener = null;
  const calls = [];
  const computer = {
    getSnapshot: () => ({ online: true, systems: [] }),
    subscribe(callback) { listener = callback; return () => { listener = null; calls.push('unsubscribe'); }; },
    isTerminalConnected: () => connected,
    dispatch: (...args) => ({ ok: true, args })
  };
  const renderer = {
    mount: () => calls.push('mount'),
    render: value => calls.push(['render', value.open]),
    unmount: () => calls.push('unmount')
  };
  const controller = createShipConsoleController({ computer, renderer });
  return {
    controller,
    calls,
    connect() { connected = true; },
    notify() { listener?.(computer.getSnapshot()); },
    get subscribed() { return Boolean(listener); }
  };
}

test('console lifecycle mounts, subscribes and releases its renderer', () => {
  const harness = createHarness();
  assert.equal(harness.controller.initialize(), true);
  assert.equal(harness.controller.initialize(), false);
  assert.equal(harness.subscribed, true);
  assert.equal(harness.controller.shutdown(), true);
  assert.equal(harness.subscribed, false);
  assert.ok(harness.calls.includes('unmount'));
});

test('console only opens with the pilot terminal connected and dispatches while open', () => {
  const harness = createHarness();
  harness.controller.initialize();
  assert.equal(harness.controller.open(), false);
  assert.deepEqual(harness.controller.dispatch('navigation', 'telemetry'), {
    ok: false,
    reason: 'console-closed'
  });

  harness.connect();
  assert.equal(harness.controller.open(), true);
  assert.equal(harness.controller.dispatch('navigation', 'telemetry').ok, true);
  assert.equal(harness.controller.close(), true);
  assert.deepEqual(harness.controller.dispatch('navigation', 'telemetry'), {
    ok: false,
    reason: 'console-closed'
  });
  harness.controller.shutdown();
});

test('Runtime lifecycle delegates initialization and shutdown to the console controller', () => {
  const calls = [];
  const runtimeSystem = createShipConsoleRuntimeSystem({
    initialize: () => calls.push('initialize'),
    shutdown: () => calls.push('shutdown')
  });
  runtimeSystem.initialize();
  runtimeSystem.shutdown();
  assert.deepEqual(calls, ['initialize', 'shutdown']);
});
