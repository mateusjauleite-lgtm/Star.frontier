import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeKernel } from './RuntimeKernel.js';

function createFakeWasmRuntime() {
  let status = 0;
  let frameCount = 0;
  let elapsedSeconds = 0;
  let deltaSeconds = 0;
  let destroyed = 0;

  return {
    get destroyed() { return destroyed; },
    _runtime_create(maximumDeltaSeconds) {
      assert.equal(maximumDeltaSeconds, 0.05);
      return 7;
    },
    _runtime_destroy(handle) {
      assert.equal(handle, 7);
      destroyed += 1;
    },
    _runtime_get_status() { return status; },
    _runtime_get_frame_count() { return frameCount; },
    _runtime_get_elapsed_seconds() { return elapsedSeconds; },
    _runtime_get_delta_seconds() { return deltaSeconds; },
    _runtime_initialize() {
      if (status !== 0 && status !== 4) return 0;
      status = 1;
      frameCount = 0;
      elapsedSeconds = 0;
      deltaSeconds = 0;
      return 1;
    },
    _runtime_start() {
      if (status !== 1) return 0;
      status = 2;
      return 1;
    },
    _runtime_pause() {
      if (status !== 2) return 0;
      status = 3;
      deltaSeconds = 0;
      return 1;
    },
    _runtime_resume() {
      if (status !== 3) return 0;
      status = 2;
      return 1;
    },
    _runtime_stop() {
      status = 4;
      deltaSeconds = 0;
      return 1;
    },
    _runtime_tick(handle, value) {
      assert.equal(handle, 7);
      if (status !== 2 || !Number.isFinite(value) || value < 0) {
        deltaSeconds = 0;
        return 0;
      }
      deltaSeconds = Math.min(value, 0.05);
      elapsedSeconds += deltaSeconds;
      frameCount += 1;
      return deltaSeconds;
    }
  };
}

test('RuntimeKernel rejects an incomplete WebAssembly export contract before creating a handle', () => {
  assert.throws(
    () => createRuntimeKernel({ _runtime_create: () => 7 }),
    /módulo WebAssembly do Runtime está incompleto/
  );
});

test('RuntimeKernel validates the complete C++ lifecycle and resets on reinitialization', () => {
  const module = createFakeWasmRuntime();
  const kernel = createRuntimeKernel(module, { maximumDeltaSeconds: 0.05 });

  assert.equal(kernel.status, 'created');
  assert.equal(kernel.initialize(), true);
  assert.equal(kernel.status, 'ready');
  assert.equal(kernel.start(), true);
  assert.equal(kernel.status, 'running');

  assert.equal(kernel.tick(0.2), 0.05);
  assert.equal(kernel.frameCount, 1);
  assert.equal(kernel.elapsedSeconds, 0.05);
  assert.equal(kernel.deltaSeconds, 0.05);

  assert.equal(kernel.pause(), true);
  assert.equal(kernel.status, 'paused');
  assert.equal(kernel.tick(0.016), 0);
  assert.equal(kernel.deltaSeconds, 0);

  assert.equal(kernel.resume(), true);
  assert.equal(kernel.status, 'running');
  assert.equal(kernel.tick(0.01), 0.01);
  assert.equal(kernel.frameCount, 2);
  assert.ok(Math.abs(kernel.elapsedSeconds - 0.06) < 1e-12);

  assert.equal(kernel.stop(), true);
  assert.equal(kernel.status, 'stopped');
  assert.equal(kernel.initialize(), true);
  assert.equal(kernel.status, 'ready');
  assert.equal(kernel.frameCount, 0);
  assert.equal(kernel.elapsedSeconds, 0);
  assert.equal(kernel.deltaSeconds, 0);

  kernel.dispose();
  kernel.dispose();
  assert.equal(kernel.status, 'disposed');
  assert.equal(module.destroyed, 1);
  assert.throws(() => kernel.tick(0.016), /já foi liberado/);
});
