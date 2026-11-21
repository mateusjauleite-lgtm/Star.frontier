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

test('botão de mineração delega a extração ao sistema registrado no Runtime', () => {
  const elements = new Map(['mine-btn', 'fire-btn', 'interact-btn'].map(id => [id, makeElement()]));
  let mineCalls = 0;
  registerGameplayActions({
    document: {},
    THREE: { Vector3: class { constructor(x,y,z) { this.x=x; this.y=y; this.z=z; } } },
    getElement: id => elements.get(id),
    state: { cargo: 0, ore: 0, credits: 0, miningDrill: 'Broca padrão' },
    isActive: () => true,
    mine: () => mineCalls++,
    getAsteroids: () => [],
    getShip: () => ({ position: {} }),
    getAsteroidSystem: () => null,
    setAsteroids() {},
    save() {},
    updateWallet() {},
    shipAudio: { playMining() {} },
    characterAudio: { playInteract() {} },
    toast() {},
    getNpcReady: () => false,
    setNpcReady() {}
  });
  elements.get('mine-btn').fire('click');
  assert.equal(mineCalls, 1);
});
