import test from 'node:test';
import assert from 'node:assert/strict';
import { registerTextInteractionGuard } from './textInteractionGuard.js';

class FakeDocument {
  listeners = new Map();
  addEventListener(type, handler, capture) {
    this.listeners.set(type, { handler, capture });
  }
  removeEventListener(type) {
    this.listeners.delete(type);
  }
  dispatch(type, properties = {}) {
    let prevented = false;
    let stopped = false;
    const event = {
      ...properties,
      preventDefault() { prevented = true; },
      stopPropagation() { stopped = true; }
    };
    this.listeners.get(type)?.handler(event);
    return { prevented, stopped };
  }
}

test('blocks clipboard, selection, context menu and drag events', () => {
  const doc = new FakeDocument();
  const unregister = registerTextInteractionGuard(doc);

  for (const type of ['copy', 'cut', 'paste', 'contextmenu', 'selectstart', 'dragstart']) {
    assert.equal(doc.dispatch(type).prevented, true, type);
    assert.equal(doc.listeners.get(type).capture, true);
  }

  unregister();
  assert.equal(doc.listeners.size, 0);
});

test('blocks keyboard clipboard and select-all shortcuts', () => {
  const doc = new FakeDocument();
  registerTextInteractionGuard(doc);

  for (const key of ['c', 'x', 'v', 'a', 'Insert']) {
    const result = doc.dispatch('keydown', { key, ctrlKey: true });
    assert.equal(result.prevented, true, key);
    assert.equal(result.stopped, true, key);
  }

  const unrelated = doc.dispatch('keydown', { key: 'w', ctrlKey: true });
  assert.equal(unrelated.prevented, false);
});

test('blocks command shortcuts on mac-style keyboards', () => {
  const doc = new FakeDocument();
  registerTextInteractionGuard(doc);

  assert.equal(doc.dispatch('keydown', { key: 'v', metaKey: true }).prevented, true);
});

test('returns a safe no-op cleanup when no event target is available', () => {
  assert.doesNotThrow(() => registerTextInteractionGuard(null)());
});
