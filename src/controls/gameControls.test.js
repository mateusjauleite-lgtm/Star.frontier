import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHeldFlightControls, registerCameraCycleControl } from './gameControls.js';

function element() {
  const listeners = new Map();
  const classes = new Set();
  return {
    listeners, classes,
    addEventListener(type, callback) { listeners.set(type, callback); },
    setPointerCapture() {},
    classList: {
      add(value) { classes.add(value); },
      remove(value) { classes.delete(value); }
    },
    fire(type, event = {}) { listeners.get(type)?.({ preventDefault() {}, ...event }); }
  };
}

test('held flight controls set and release throttle state', () => {
  const buttons = new Map(['throttle-btn', 'brake-btn', 'nitro-btn'].map(id => [id, element()]));
  const windowListeners = new Map();
  const document = { getElementById: id => buttons.get(id) || null };
  const window = { addEventListener: (type, callback) => windowListeners.set(type, callback) };
  const state = { throttle: false, braking: false, nitroButton: false };

  registerHeldFlightControls({ document, window, state });
  const throttle = buttons.get('throttle-btn');
  throttle.fire('pointerdown', { pointerId: 7, pointerType: 'touch' });
  assert.equal(state.throttle, true);
  assert.equal(throttle.classes.has('active'), true);
  throttle.fire('pointerup', { pointerId: 7 });
  assert.equal(state.throttle, false);
  assert.equal(throttle.classes.has('active'), false);
});

test('camera cycle control preserves the three existing camera modes', () => {
  const button = element();
  button.textContent = '';
  const document = { getElementById: id => id === 'camera-btn' ? button : null };
  const state = { camera: 0 };
  registerCameraCycleControl({ document, state, cameraNames: ['FIRST', 'BRIDGE', 'THIRD'] });
  button.fire('click');
  assert.equal(state.camera, 1);
  assert.equal(button.textContent, 'BRIDGE');
  button.fire('click');
  button.fire('click');
  assert.equal(state.camera, 0);
  assert.equal(button.textContent, 'FIRST');
});
