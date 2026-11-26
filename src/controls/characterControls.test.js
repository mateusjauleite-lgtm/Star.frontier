import test from 'node:test';
import assert from 'node:assert/strict';
import { registerCharacterControls } from './characterControls.js';

function makeElement({ width = 100 } = {}) {
  const listeners = new Map();
  const classes = new Set();
  return {
    listeners,
    classes,
    style: {},
    disabled: false,
    textContent: '',
    addEventListener(type, callback) {
      const callbacks = listeners.get(type) || [];
      callbacks.push(callback);
      listeners.set(type, callbacks);
    },
    setPointerCapture() {},
    getBoundingClientRect() {
      return { left: 0, top: 0, right: width, bottom: width, width, height: width };
    },
    querySelector(selector) {
      if (selector === '.character-move-knob') return this.knob || null;
      return null;
    },
    classList: {
      add(value) { classes.add(value); },
      remove(value) { classes.delete(value); }
    },
    fire(type, event = {}) {
      for (const callback of listeners.get(type) || []) {
        callback({
          pointerId: 1,
          clientX: 50,
          clientY: 50,
          preventDefault() {},
          stopPropagation() {},
          ...event,
          type
        });
      }
    }
  };
}

function setup() {
  const ids = [
    'character-move-stick',
    'character-jump-btn',
    'character-sprint-btn',
    'character-phaser-btn',
    'character-aim-btn',
    'character-aim-stick'
  ];
  const elements = new Map(ids.map(id => [id, makeElement()]));
  const knob = makeElement();
  elements.get('character-move-stick').knob = knob;
  elements.get('character-aim-stick').getBoundingClientRect = () => ({
    left: 150, top: 0, right: 250, bottom: 100, width: 100, height: 100
  });
  elements.get('character-aim-stick').knob = makeElement();
  const document = { getElementById: id => elements.get(id) || null };
  const windowListeners = new Map();
  const window = {
    addEventListener(type, callback) {
      const callbacks = windowListeners.get(type) || [];
      callbacks.push(callback);
      windowListeners.set(type, callbacks);
    },
    fire(type, event = {}) {
      for (const callback of windowListeners.get(type) || []) callback(event);
    }
  };
  let onFoot = true;
  let grounded = true;
  const fired = [];
  const aimed = [];
  const controls = registerCharacterControls({
    document,
    window,
    isOnFoot: () => onFoot,
    isGrounded: () => grounded,
    onFirePhaser: () => fired.push('phaser'),
    onToggleAim: () => aimed.push('toggle'),
    onAimLook: (dx, dy) => aimed.push([dx, dy])
  });
  return {
    controls, elements, knob, window,
    setOnFoot(value) { onFoot = value; },
    setGrounded(value) { grounded = value; },
    fired, aimed
  };
}

test('character joystick normalizes movement and releases it on pointer end', () => {
  const { controls, elements, knob } = setup();
  const stick = elements.get('character-move-stick');
  stick.fire('pointerdown', { pointerId: 4, clientX: 81, clientY: 50 });
  assert.ok(controls.getMoveInput().x > 0.99);
  assert.equal(controls.getMoveInput().y, 0);
  assert.match(knob.style.transform, /translate/);
  stick.fire('pointerup', { pointerId: 4 });
  assert.deepEqual(controls.getMoveInput(), { x: 0, y: 0 });
});

test('right aim joystick drives camera direction and recenters on release', () => {
  const { controls, elements, aimed } = setup();
  const stick = elements.get('character-aim-stick');
  stick.fire('pointerdown', { pointerId: 14, clientX: 50, clientY: 50 });
  stick.fire('pointermove', { pointerId: 14, clientX: 80, clientY: 50 });
  assert.ok(controls.getAimInput().x > 0.8);
  controls.updateAim(1 / 60);
  assert.equal(aimed.length, 1);
  assert.ok(aimed[0][0] > 0);
  stick.fire('pointerup', { pointerId: 14 });
  assert.deepEqual(controls.getAimInput(), { x: 0, y: 0 });
});

test('movement joystick touch does not invoke camera look', () => {
  const { controls, elements, aimed } = setup();
  const stick = elements.get('character-move-stick');
  stick.fire('pointerdown', { pointerId: 12, clientX: 80, clientY: 50 });
  stick.fire('pointermove', { pointerId: 12, clientX: 90, clientY: 50 });
  assert.ok(controls.getMoveInput().x > 0);
  assert.deepEqual(aimed, []);
  stick.fire('pointerup', { pointerId: 12 });
});

test('jump is queued only while on foot and grounded, then consumed once', () => {
  const { controls, elements, setOnFoot, setGrounded } = setup();
  const jump = elements.get('character-jump-btn');
  setGrounded(false);
  jump.fire('pointerdown');
  assert.equal(controls.consumeJump(), false);
  setGrounded(true);
  setOnFoot(false);
  jump.fire('pointerdown');
  assert.equal(controls.consumeJump(), false);
  setOnFoot(true);
  jump.fire('pointerdown');
  assert.equal(controls.consumeJump(), true);
  assert.equal(controls.consumeJump(), false);
});

test('sprint is held by touch and released by pointer end or blur', () => {
  const { controls, elements, window } = setup();
  const sprint = elements.get('character-sprint-btn');
  sprint.fire('pointerdown');
  assert.equal(controls.isSprinting(), true);
  assert.equal(sprint.classes.has('is-active'), true);
  sprint.fire('pointerup');
  assert.equal(controls.isSprinting(), false);
  window.fire('keydown', { code: 'ShiftLeft', repeat: false });
  assert.equal(controls.isSprinting(), true);
  window.fire('blur');
  assert.equal(controls.isSprinting(), false);
});

test('phaser and aim controls delegate actions without owning weapon state', () => {
  const { elements, fired, aimed } = setup();
  const phaser = elements.get('character-phaser-btn');
  phaser.fire('pointerup');
  phaser.fire('click', { detail: 1 });
  phaser.fire('click', { detail: 0 });
  assert.deepEqual(fired, ['phaser', 'phaser']);
  elements.get('character-aim-btn').fire('click');
  const aimArea = elements.get('character-aim-area');
  aimArea.fire('pointerdown', { pointerId: 9, clientX: 160, clientY: 20 });
  aimArea.fire('pointermove', { pointerId: 9, clientX: 168, clientY: 25 });
  aimArea.fire('pointerup', { pointerId: 9 });
  assert.deepEqual(aimed, ['toggle', [8, 5]]);
});

test('reset clears all transient character inputs', () => {
  const { controls, elements } = setup();
  elements.get('character-move-stick').fire('pointerdown', { pointerId: 2, clientX: 80, clientY: 50 });
  elements.get('character-jump-btn').fire('pointerdown');
  elements.get('character-sprint-btn').fire('pointerdown');
  elements.get('character-aim-stick').fire('pointerdown', { pointerId: 3, clientX: 80, clientY: 50 });
  controls.reset();
  assert.deepEqual(controls.getMoveInput(), { x: 0, y: 0 });
  assert.deepEqual(controls.getAimInput(), { x: 0, y: 0 });
  assert.equal(controls.isSprinting(), false);
  assert.equal(controls.consumeJump(), false);
});
