import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameplayControlModeController } from './gameplayControlModes.js';

function fixture() {
  const elements = new Map(['hud', 'warp-drive-display', 'flight-controls', 'leave-pilot-btn'].map(id => [id, {
    classList: { hidden: false, toggle(name, hidden) { this[name] = hidden; } }
  }]));
  const document = { getElementById: id => elements.get(id) || null };
  const calls = [];
  const characterHUD = { show: visible => calls.push(['character-hud', visible]) };
  const characterControls = {
    reset: () => calls.push(['character-reset']),
    setEnabled: enabled => calls.push(['character-enabled', enabled])
  };
  const shipMovementControls = {
    reset: () => calls.push(['ship-reset']),
    setEnabled: enabled => calls.push(['ship-enabled', enabled])
  };
  const layouts = [];
  const controller = createGameplayControlModeController({
    document, characterHUD, characterControls, shipMovementControls,
    applyHudLayout: (...args) => layouts.push(args),
    readHudLayout: profile => ({ profile })
  });
  return { controller, elements, calls, layouts };
}

test('walking in ship and on planet uses only character controls and HUD', () => {
  const { controller, elements, calls } = fixture();
  controller.setMode('on-foot-ship');
  assert.equal(controller.isCharacterActive(), true);
  assert.equal(controller.isPilotActive(), false);
  controller.setMode('on-foot-planet');
  assert.equal(controller.getMode(), 'on-foot-planet');
  assert.equal(calls.filter(call => call[0] === 'character-enabled' && call[1] === true).length, 2);
  assert.equal(calls.filter(call => call[0] === 'ship-enabled' && call[1] === false).length, 2);
  assert.equal(elements.get('flight-controls').classList.hidden, true);
});

test('piloting disables character input and enables only ship input', () => {
  const { controller, elements, calls } = fixture();
  controller.setMode('on-foot-ship');
  controller.setMode('piloting');
  assert.equal(controller.isPilotActive(), true);
  assert.equal(controller.isCharacterActive(), false);
  assert.equal(calls.at(-1)[0], 'ship-enabled');
  assert.equal(calls.at(-1)[1], true);
  assert.equal(elements.get('flight-controls').classList.hidden, false);
  assert.equal(elements.get('character-controls'), undefined);
});

test('switching modes resets both input channels before activation', () => {
  const { controller, calls } = fixture();
  controller.setMode('on-foot-ship');
  calls.length = 0;
  controller.setMode('piloting');
  assert.deepEqual(calls.slice(0, 4), [
    ['character-reset'], ['ship-reset'], ['character-enabled', false], ['ship-enabled', true]
  ]);
});

test('inactive mode hides both interfaces and blocks both input channels', () => {
  const { controller, elements, calls } = fixture();
  controller.setMode('inactive');
  assert.equal(controller.isCharacterActive(), false);
  assert.equal(controller.isPilotActive(), false);
  assert.equal(elements.get('hud').classList.hidden, true);
  assert.equal(calls.at(-1)[0], 'ship-enabled');
  assert.equal(calls.at(-1)[1], false);
});
