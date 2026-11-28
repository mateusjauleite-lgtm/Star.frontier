import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameplayControlModeController } from './gameplayControlModes.js';

function fixture() {
  const elements = new Map(['hud', 'warp-drive-display', 'flight-controls', 'leave-pilot-btn'].map(id => [id, {
    classList: { hidden: false, toggle(name, hidden) { this[name] = hidden; } }
  }]));
  const document = { getElementById: id => elements.get(id) || null };
  const calls = [];
  const channel = name => ({
    reset: () => calls.push([name + '-reset']),
    setEnabled: enabled => calls.push([name + '-enabled', enabled])
  });
  const characterHUD = { show: visible => calls.push(['character-hud', visible]) };
  const characterControls = channel('character');
  const shipMovementControls = channel('ship-move');
  const shipAimControls = channel('ship-aim');
  const shipCommandControls = channel('ship-commands');
  const layouts = [];
  const controller = createGameplayControlModeController({
    document, characterHUD, characterControls, shipMovementControls, shipAimControls, shipCommandControls,
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
  assert.equal(calls.filter(call => call[0] === 'ship-move-enabled' && call[1] === false).length, 2);
  assert.equal(calls.filter(call => call[0] === 'ship-aim-enabled' && call[1] === false).length, 2);
  assert.equal(calls.filter(call => call[0] === 'ship-commands-enabled' && call[1] === false).length, 2);
  assert.equal(elements.get('flight-controls').classList.hidden, true);
});

test('piloting disables character input and enables all ship input channels', () => {
  const { controller, elements, calls } = fixture();
  controller.setMode('on-foot-ship');
  controller.setMode('piloting');
  assert.equal(controller.isPilotActive(), true);
  assert.equal(controller.isCharacterActive(), false);
  assert.equal(calls.at(-1)[0], 'ship-commands-enabled');
  assert.equal(calls.at(-1)[1], true);
  assert.equal(calls.filter(call => call[0] === 'ship-aim-enabled' && call[1] === true).length, 1);
  assert.equal(elements.get('flight-controls').classList.hidden, false);
});

test('switching modes resets every input channel before activation', () => {
  const { controller, calls } = fixture();
  controller.setMode('on-foot-ship');
  calls.length = 0;
  controller.setMode('piloting');
  assert.deepEqual(calls.slice(0, 5), [
    ['character-reset'], ['ship-move-reset'], ['ship-aim-reset'], ['ship-commands-reset'], ['character-enabled', false]
  ]);
});

test('inactive mode hides both interfaces and blocks all input channels', () => {
  const { controller, elements, calls } = fixture();
  controller.setMode('inactive');
  assert.equal(controller.isCharacterActive(), false);
  assert.equal(controller.isPilotActive(), false);
  assert.equal(elements.get('hud').classList.hidden, true);
  assert.equal(calls.at(-1)[0], 'ship-commands-enabled');
  assert.equal(calls.at(-1)[1], false);
});
