import test from 'node:test';
import assert from 'node:assert/strict';
import { createPauseMenuRuntimeSystem } from './pauseMenuSystem.js';

class FakeElement {
  constructor(hidden = false) {
    this.listeners = new Map();
    this.attributes = {};
    this.classes = new Set(hidden ? ['hidden'] : []);
    this.classList = {
      add: name => this.classes.add(name),
      remove: name => this.classes.delete(name),
      contains: name => this.classes.has(name)
    };
  }
  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) ?? new Set();
    handlers.add(handler);
    this.listeners.set(type, handlers);
  }
  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  dispatch(type) {
    for (const handler of this.listeners.get(type) ?? []) handler({ preventDefault() {} });
  }
}

function createFixture() {
  const elements = new Map([
    ['character-menu-btn', new FakeElement()],
    ['game-menu-btn', new FakeElement()],
    ['resume-btn', new FakeElement()],
    ['pause-menu-actions', new FakeElement()],
    ['pause-settings-panel', new FakeElement(true)],
    ['game-menu-modal', new FakeElement(true)]
  ]);
  const document = { getElementById: id => elements.get(id) ?? null };
  let status = 'running';
  const calls = { pause: 0, resume: 0, reset: 0 };
  const runtime = {
    get status() { return status; },
    pause() { calls.pause += 1; status = 'paused'; return true; },
    resume() { calls.resume += 1; status = 'running'; return true; }
  };
  const state = { throttle: true, braking: true, warpDriveButton: true };
  const system = createPauseMenuRuntimeSystem({
    runtime,
    document,
    state,
    resetInputs: () => { calls.reset += 1; }
  });
  return { elements, calls, state, system };
}

test('menu de pausa abre, interrompe o Runtime e libera comandos de propulsão', () => {
  const { elements, calls, state, system } = createFixture();
  system.initialize();
  elements.get('pause-menu-actions').classList.add('hidden');
  elements.get('pause-settings-panel').classList.remove('hidden');
  elements.get('game-menu-btn').dispatch('click');

  assert.equal(elements.get('pause-menu-actions').classList.contains('hidden'), false);
  assert.equal(elements.get('pause-settings-panel').classList.contains('hidden'), true);
  assert.equal(elements.get('game-menu-modal').classList.contains('hidden'), false);
  assert.equal(elements.get('game-menu-modal').attributes['aria-hidden'], 'false');
  assert.equal(calls.pause, 1);
  assert.equal(calls.reset, 1);
  assert.equal(state.throttle, false);
  assert.equal(state.braking, false);
  assert.equal(state.warpDriveButton, false);
});

test('continuar fecha o menu e retoma o Runtime', () => {
  const { elements, calls, system } = createFixture();
  system.initialize();
  elements.get('character-menu-btn').dispatch('click');
  elements.get('resume-btn').dispatch('click');

  assert.equal(elements.get('game-menu-modal').classList.contains('hidden'), true);
  assert.equal(elements.get('game-menu-modal').attributes['aria-hidden'], 'true');
  assert.equal(calls.pause, 1);
  assert.equal(calls.resume, 1);
});

test('shutdown remove os eventos do menu de pausa', () => {
  const { elements, calls, system } = createFixture();
  system.initialize();
  system.shutdown();
  elements.get('game-menu-btn').dispatch('click');

  assert.equal(calls.pause, 0);
  assert.equal(elements.get('game-menu-modal').classList.contains('hidden'), true);
});
