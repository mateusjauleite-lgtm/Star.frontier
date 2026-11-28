import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSession } from './characterSession.js';

test('main-menu suspension preserves the character state for resume', () => {
  const character = { id: 'player-1', health: 84, location: 'earth-jaú' };
  const events = [];
  const session = createCharacterSession({
    captureState: () => ({ ...character }),
    restoreState: state => Object.assign(character, state),
    onStart: event => events.push(['start', event || null]),
    onEnd: event => events.push(['end', event.suspended])
  });
  assert.equal(session.start(), true);
  character.location = 'aurora-deck-2';
  assert.equal(session.suspend(), true);
  character.location = 'menu-preview';
  assert.equal(session.getStatus(), 'suspended');
  assert.equal(session.resume(), true);
  assert.equal(character.location, 'aurora-deck-2');
  assert.equal(character.health, 84);
  assert.equal(session.getStatus(), 'active');
  assert.deepEqual(events, [['start', null], ['end', true], ['start', { resumed: true }]]);
});

test('ending a session does not destroy the character unless explicitly requested', () => {
  const character = { id: 'player-2', health: 61 };
  const destroyed = [];
  const session = createCharacterSession({
    captureState: () => ({ ...character }),
    restoreState: state => Object.assign(character, state),
    onDestroy: state => destroyed.push(state)
  });
  session.start();
  assert.equal(session.end(), true);
  assert.equal(destroyed.length, 0);
  assert.equal(session.getStatus(), 'idle');
  session.start();
  assert.equal(session.end({ destroyCharacter: true }), true);
  assert.equal(destroyed.length, 1);
  assert.equal(destroyed[0].health, 61);
});

test('invalid session configuration is rejected', () => {
  assert.throws(() => createCharacterSession(), /capturar e restaurar/);
});
