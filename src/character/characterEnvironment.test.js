import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterEnvironmentRouter } from './characterEnvironment.js';

function adapter(type, calls = []) {
  return {
    type,
    attach(character, environment) { calls.push(['attach', type, character.id, environment.id]); },
    detach(character, environment) { calls.push(['detach', type, character.id, environment.id]); },
    move(character, input, dt, environment) {
      calls.push(['move', type, character.id, input, dt, environment.id]);
      return { accepted: true, context: type };
    },
    resolveGroundContact(position) { return { position, context: type }; },
    update(character, dt) { return { character: character.id, dt, context: type }; }
  };
}

test('character switches between ship and planetary adapters without changing identity', () => {
  const calls = [];
  const router = createCharacterEnvironmentRouter();
  const character = { id: 'player-1' };
  router.register('aurora-7', adapter('ship', calls));
  router.register('earth', adapter('planet-surface', calls));
  router.activate('aurora-7', character, { id: 'deck-2' });
  assert.deepEqual(router.getActiveContext(), { id: 'aurora-7', type: 'ship' });
  router.activate('earth', character, { id: 'earth-jaú' });
  assert.deepEqual(router.getActiveContext(), { id: 'earth', type: 'planet-surface' });
  assert.equal(calls.filter(call => call[0] === 'attach' && call[2] === character.id).length, 2);
  assert.equal(calls.filter(call => call[0] === 'detach' && call[2] === character.id).length, 1);
  assert.equal(character.id, 'player-1');
});

test('movement and ground contact are delegated to the active environment', () => {
  const router = createCharacterEnvironmentRouter();
  const character = { id: 'player-2' };
  router.register('moon', adapter('planet-surface'));
  assert.deepEqual(router.move({ x: 0, y: 1 }, 0.016), { accepted: false, reason: 'no-active-environment' });
  router.activate('moon', character, {});
  assert.deepEqual(router.move({ x: 0.5, y: -1 }, 0.016), { accepted: true, context: 'planet-surface' });
  assert.equal(router.resolveGroundContact({ x: 1, y: 2, z: 3 }).context, 'planet-surface');
  assert.deepEqual(router.update(0.02), { character: 'player-2', dt: 0.02, context: 'planet-surface' });
});

test('failed activation restores the previous environment binding', () => {
  const router = createCharacterEnvironmentRouter();
  const character = { id: 'player-3' };
  router.register('ship', adapter('ship'));
  router.register('broken-world', {
    type: 'planet-surface',
    attach() { throw new Error('surface unavailable'); },
    detach() {},
    move() {},
    resolveGroundContact() { return null; }
  });
  router.activate('ship', character, {});
  assert.throws(() => router.activate('broken-world', character, {}), /surface unavailable/);
  assert.deepEqual(router.getActiveContext(), { id: 'ship', type: 'ship' });
});

test('active adapter cannot be unregistered before its context is detached', () => {
  const router = createCharacterEnvironmentRouter();
  const unregister = router.register('station', adapter('station'));
  router.activate('station', { id: 'player-4' }, {});
  assert.throws(() => unregister(), /Desative o contexto/);
  router.deactivate();
  assert.equal(unregister(), true);
  assert.equal(unregister(), false);
});

test('invalid adapters and movement input are rejected', () => {
  const router = createCharacterEnvironmentRouter();
  assert.throws(() => router.register('bad', { type: 'ship' }), /implementar attach/);
  router.register('ship', adapter('ship'));
  router.activate('ship', { id: 'player-5' }, {});
  assert.throws(() => router.move({ x: NaN, y: 0 }, 0.016), /x e y válidos/);
});
