import test from 'node:test';
import assert from 'node:assert/strict';
import { createCameraRuntimeSystem } from './cameraRuntimeSystem.js';
import { createCameraState } from '../camera/cameraState.js';
import { createCameraInputController } from '../camera/cameraInputController.js';

function fixture() {
  const calls = [];
  let characterMode = 'ship-control';
  let shipMode = 0;
  let characterCameraMode = 'third-person';
  const runtime = createCameraRuntimeSystem({
    getCharacterMode: () => characterMode,
    getShipMode: () => shipMode,
    getCharacterCameraMode: () => characterCameraMode,
    shipController: { update: () => calls.push('ship') },
    characterController: { update: () => calls.push('character') }
  });
  return {
    calls,
    runtime,
    setCharacterMode: value => { characterMode = value; },
    setShipMode: value => { shipMode = value; },
    setCharacterCameraMode: value => { characterCameraMode = value; }
  };
}

test('camera runtime exposes one active controller and routes ship and character modes', () => {
  const f = fixture();
  const context = {};
  f.runtime.initialize(context);
  assert.equal(context.cameraRuntime, f.runtime.service);

  f.runtime.service.updateActive();
  f.setCharacterMode('on-foot');
  f.runtime.service.updateActive();

  assert.deepEqual(f.calls, ['ship', 'character']);
  assert.equal(f.runtime.service.state.activeController, 'character');
  assert.equal(f.runtime.service.state.activeMode, 'third-person');
  assert.equal(f.runtime.service.state.frame, 2);

  f.runtime.shutdown(context);
  assert.equal('cameraRuntime' in context, false);
  assert.equal(f.runtime.service.state.activeController, 'none');
});

test('camera runtime does not update before initialization', () => {
  const f = fixture();
  assert.equal(f.runtime.service.updateActive(), false);
  assert.deepEqual(f.calls, []);
});

test('camera runtime tracks controller transitions and current modes', () => {
  const f = fixture();
  f.runtime.initialize({});
  f.runtime.service.updateActive();
  assert.equal(f.runtime.service.state.transition.status, 'idle');

  f.setCharacterMode('on-foot');
  f.setCharacterCameraMode('first-person');
  f.runtime.service.updateActive();
  assert.equal(f.runtime.service.state.activeController, 'character');
  assert.equal(f.runtime.service.state.activeMode, 'first-person');
  assert.equal(f.runtime.service.state.transition.from, 'ship');
  assert.equal(f.runtime.service.state.transition.to, 'character');
  assert.equal(f.runtime.service.state.transition.status, 'idle');
});

test('camera input adapter validates and stores camera mode, view and aim intent', () => {
  const state = { camera: 0, view: { x: 0, y: 0 }, aim: { x: 0, y: 0 } };
  const cameraState = createCameraState();
  const input = createCameraInputController({
    state,
    cameraState,
    THREE: {
      MathUtils: {
        clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
        euclideanModulo: (n, m) => ((n % m) + m) % m
      }
    }
  });

  assert.equal(input.setShipMode(2), true);
  assert.equal(input.setShipMode(3), false);
  assert.equal(input.setCharacterMode('first-person'), true);
  assert.equal(input.setCharacterMode('cinematic'), false);
  assert.equal(input.setView(9, Math.PI * 3), true);
  assert.equal(state.view.x, 1.45);
  assert.equal(state.view.y, -Math.PI);
  assert.equal(input.setAim(-2, 2), true);
  assert.deepEqual(state.aim, { x: -1, y: 1 });
  input.resetAim();
  assert.deepEqual(state.aim, { x: 0, y: 0 });
});
