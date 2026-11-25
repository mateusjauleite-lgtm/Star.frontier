import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHeldFlightControls, registerCameraCycleControl } from './gameControls.js';

function element() {
  const listeners = new Map();
  const classes = new Set();
  return {
    listeners, classes,
    addEventListener(type, callback) { listeners.set(type, callback); },
    attributes: {},
    setPointerCapture() {},
    setAttribute(name, value) { this.attributes[name] = value; },
    classList: {
      add(value) { classes.add(value); },
      remove(value) { classes.delete(value); },
      toggle(value, force) { if (force) classes.add(value); else classes.delete(value); }
    },
    fire(type, event = {}) { listeners.get(type)?.({ preventDefault() {}, ...event }); }
  };
}

test('propulsor principal alterna entre ligado e desligado com toques', () => {
  const buttons = new Map(['throttle-btn', 'brake-btn', 'nitro-btn'].map(id => [id, element()]));
  const windowListeners = new Map();
  const document = { getElementById: id => buttons.get(id) || null };
  const window = { addEventListener: (type, callback) => windowListeners.set(type, callback) };
  const state = { throttle: false, braking: false, nitroButton: false };

  registerHeldFlightControls({ document, window, state });
  const throttle = buttons.get('throttle-btn');
  throttle.fire('click');
  assert.equal(state.throttle, true);
  assert.equal(throttle.classes.has('active'), true);
  assert.equal(throttle.attributes['aria-pressed'], 'true');
  throttle.fire('click');
  assert.equal(state.throttle, false);
  assert.equal(throttle.classes.has('active'), false);
  assert.equal(throttle.attributes['aria-pressed'], 'false');
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


test('propulsor envia comandos de ligar e desligar ao Ship Computer', () => {
  const throttle = element();
  const document = { getElementById: id => id === 'throttle-btn' ? throttle : null };
  const window = { addEventListener() {} };
  const state = { throttle: false };
  const commands = [];
  registerHeldFlightControls({
    document, window, state,
    dispatchPropulsionCommand: payload => {
      commands.push(payload);
      return { accepted: true };
    }
  });
  throttle.fire('click');
  throttle.fire('click');
  assert.deepEqual(commands, [
    { control: 'throttle', active: true },
    { control: 'throttle', active: false }
  ]);
  assert.equal(state.throttle, false);
  assert.equal(throttle.attributes['aria-pressed'], 'false');
});

test('botão de dobra alterna o comando travado e sincroniza estado visual', () => {
  const warp = element();
  const buttons = new Map([['warp-drive-btn', warp]]);
  const document = { getElementById: id => buttons.get(id) || null };
  const window = { addEventListener() {} };
  const state = { warpDriveButton: false };
  const commands = [];
  registerHeldFlightControls({
    document, window, state,
    dispatchPropulsionCommand: payload => {
      commands.push(payload);
      state.warpDriveButton = payload.active;
      return { accepted: true };
    }
  });
  warp.fire('click');
  assert.deepEqual(commands[0], { control: 'warpDriveButton', active: true });
  assert.equal(state.warpDriveButton, true);
  assert.equal(warp.attributes['aria-pressed'], 'true');
  assert.equal(warp.classes.has('active'), true);
  warp.fire('click');
  assert.deepEqual(commands[1], { control: 'warpDriveButton', active: false });
  assert.equal(state.warpDriveButton, false);
  assert.equal(warp.attributes['aria-pressed'], 'false');
  assert.equal(warp.classes.has('active'), false);
});

test('botão de dobra informa rejeição sem fingir que ativou', () => {
  const warp = element();
  const document = { getElementById: id => id === 'warp-drive-btn' ? warp : null };
  const window = { addEventListener() {} };
  const state = { warpDriveButton: false };
  let rejected = null;
  registerHeldFlightControls({
    document, window, state,
    dispatchPropulsionCommand: () => ({ accepted: false, reason: 'dilithium-unavailable' }),
    onWarpRejected: reason => { rejected = reason; }
  });
  warp.fire('click');
  assert.equal(rejected, 'dilithium-unavailable');
  assert.equal(state.warpDriveButton, false);
  assert.equal(warp.attributes['aria-pressed'], 'false');
});

test('manobradores mantêm o comando pressionado e liberam ao soltar o toque', () => {
  const ids = ['throttle-btn', 'brake-btn', 'maneuver-left-btn', 'maneuver-right-btn', 'maneuver-up-btn', 'maneuver-down-btn'];
  const buttons = new Map(ids.map(id => [id, element()]));
  const document = { getElementById: id => buttons.get(id) || null };
  const window = { addEventListener() {} };
  const state = { maneuver: { left: false, right: false, up: false, down: false } };
  const commands = [];
  registerHeldFlightControls({
    document, window, state,
    dispatchPropulsionCommand: payload => {
      commands.push(payload);
      const direction = payload.control.slice('maneuver'.length).toLowerCase();
      state.maneuver[direction] = payload.active;
      return { accepted: true };
    }
  });
  const up = buttons.get('maneuver-up-btn');
  up.fire('pointerdown', { pointerId: 9, pointerType: 'touch' });
  assert.equal(state.maneuver.up, true);
  assert.equal(commands[0].control, 'maneuverUp');
  up.fire('pointerup', { pointerId: 9 });
  assert.equal(state.maneuver.up, false);
  assert.equal(commands[1].active, false);
});
