import test from 'node:test';
import assert from 'node:assert/strict';
import { registerShipMovementControls } from './shipMovementControls.js';

function makeElement() {
  const listeners = new Map();
  const classes = new Set();
  const knob = { style: { transform: '' } };
  return {
    listeners, knob, classes,
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name))
    },
    querySelector: () => knob,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    addEventListener: (type, fn) => listeners.set(type, fn),
    setPointerCapture: () => {},
    hasPointerCapture: () => false,
    releasePointerCapture: () => {},
    dispatch(type, event) { listeners.get(type)?.({ preventDefault() {}, pointerType: 'touch', button: 0, ...event }); }
  };
}

test('ship joystick writes only to the ship movement vector and resets on release', () => {
  const element = makeElement();
  const windowListeners = new Map();
  const state = { move: { x: 0, y: 0 } };
  const document = { getElementById: id => id === 'move-stick' ? element : null };
  const controls = registerShipMovementControls({
    document,
    window: { addEventListener: (type, fn) => windowListeners.set(type, fn) },
    state,
    THREE: { MathUtils: { clamp: (value, min, max) => Math.max(min, Math.min(max, value)) } },
    hasPropulsion: () => true
  });

  controls.setEnabled(true);
  element.dispatch('pointerdown', { pointerId: 7, clientX: 80, clientY: 50 });
  assert.ok(state.move.x > 0);
  assert.equal(state.move.y, 0);
  element.dispatch('pointerup', { pointerId: 7 });
  assert.deepEqual(state.move, { x: 0, y: 0 });
});

test('disabled ship joystick ignores new pointer input and clears held movement', () => {
  const element = makeElement();
  const state = { move: { x: 0.8, y: -0.4 } };
  const controls = registerShipMovementControls({
    document: { getElementById: id => id === 'move-stick' ? element : null },
    window: { addEventListener() {} },
    state,
    THREE: { MathUtils: { clamp: value => value } },
    hasPropulsion: () => true
  });

  controls.setEnabled(true);
  element.dispatch('pointerdown', { pointerId: 8, clientX: 80, clientY: 50 });
  assert.notDeepEqual(state.move, { x: 0, y: 0 });
  controls.setEnabled(false);
  element.dispatch('pointerdown', { pointerId: 8, clientX: 80, clientY: 50 });
  assert.deepEqual(state.move, { x: 0, y: 0 });
  assert.equal(controls.isEnabled(), false);
});
