import test from 'node:test';
import assert from 'node:assert/strict';
import { registerGameplayActions } from './gameplayActions.js';

function makeElement() {
  const listeners = new Map();
  return {
    listeners, innerHTML: '', classList: { add() {}, remove() {} },
    addEventListener(type, callback) { listeners.set(type, callback); },
    fire(type) { listeners.get(type)?.(); }
  };
}

test('mining action preserves cargo limits and updates resources', () => {
  const elements = new Map(['mine-btn', 'fire-btn', 'interact-btn'].map(id => [id, makeElement()]));
  const asteroid = { position: { distanceTo: () => 10 }, userData: { ore: 10 } };
  const ship = { position: {} };
  const state = { cargo: 0, ore: 0, credits: 0, miningDrill: 'Broca padrão' };
  let saved = 0, mined = 0, walletUpdates = 0;
  const messages = [];
  registerGameplayActions({
    document: {}, THREE: { Vector3: class { constructor(x,y,z) { this.x=x; this.y=y; this.z=z; } } },
    getElement: id => elements.get(id), state, isActive: () => true,
    getAsteroids: () => [asteroid], getShip: () => ship,
    getAsteroidSystem: () => null, setAsteroids() {},
    save: () => saved++, updateWallet: () => walletUpdates++,
    shipAudio: { playMining: () => mined++ }, characterAudio: { playInteract() {} },
    toast: message => messages.push(message), getNpcReady: () => false, setNpcReady() {}
  });
  elements.get('mine-btn').fire('click');
  assert.equal(state.cargo, 6);
  assert.equal(state.ore, 6);
  assert.equal(asteroid.userData.ore, 4);
  assert.equal(saved, 1);
  assert.equal(walletUpdates, 1);
  assert.equal(mined, 1);
  assert.match(messages[0], /\+6 unidades/);
});
