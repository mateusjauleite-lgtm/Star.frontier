import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeVisibilityHandler } from './RuntimeVisibility.js';

function createRuntime(initialStatus = 'running') {
  return {
    status: initialStatus,
    pause() {
      if (this.status !== 'running') return false;
      this.status = 'paused';
      return true;
    },
    resume() {
      if (this.status !== 'paused') return false;
      this.status = 'running';
      return true;
    }
  };
}

test('visibility return resumes only a Runtime paused by visibility', () => {
  const runtime = createRuntime();
  let active = true;
  let resets = 0;
  const handleVisibility = createRuntimeVisibilityHandler({
    getRuntime: () => runtime,
    isActive: () => active,
    resetInputs: () => resets++
  });

  handleVisibility(true);
  assert.equal(runtime.status, 'paused');
  assert.equal(resets, 1);
  handleVisibility(false);
  assert.equal(runtime.status, 'running');
});

test('visibility return preserves a manual pause', () => {
  const runtime = createRuntime('paused');
  const handleVisibility = createRuntimeVisibilityHandler({
    getRuntime: () => runtime,
    isActive: () => true
  });

  handleVisibility(true);
  handleVisibility(false);
  assert.equal(runtime.status, 'paused');
});

test('visibility return does not resume a stopped or inactive session', () => {
  const runtime = createRuntime();
  let active = true;
  const handleVisibility = createRuntimeVisibilityHandler({
    getRuntime: () => runtime,
    isActive: () => active
  });

  handleVisibility(true);
  active = false;
  handleVisibility(false);
  assert.equal(runtime.status, 'paused');
});
