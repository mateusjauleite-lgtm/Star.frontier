import test from 'node:test';
import assert from 'node:assert/strict';
import { createMiningRuntimeSystem } from './miningSystem.js';

function setup({ ore = 10, dilithium = 0, active = true } = {}) {
  const state = { cargo: 0, ore: 0, rawDilithiumOre: 0, miningDrill: 'Broca padrão' };
  const asteroid = {
    position: { distanceTo: () => 5 },
    userData: { ore, resources: dilithium ? { 'resource:ore-dilithium': { amount: dilithium } } : {} },
    children: []
  };
  const calls = { save: 0, wallet: 0, audio: 0, messages: [] };
  const system = createMiningRuntimeSystem({
    state, isActive: () => active, getAsteroids: () => [asteroid],
    getShip: () => ({ position: {} }), setAsteroids() {},
    save: () => calls.save++, updateWallet: () => calls.wallet++,
    shipAudio: { playMining: () => calls.audio++ }, toast: message => calls.messages.push(message)
  });
  return { state, asteroid, calls, system };
}

test('mineração comum transfere minério para carga e persiste o resultado', () => {
  const { state, asteroid, calls, system } = setup({ ore: 10 });
  assert.equal(system.mine(), true);
  assert.equal(asteroid.userData.ore, 4);
  assert.equal(state.ore, 6);
  assert.equal(state.cargo, 6);
  assert.equal(calls.save, 1);
  assert.equal(calls.wallet, 1);
  assert.equal(calls.audio, 1);
});

test('mineração de dilítio abastece o estoque bruto sem ocupar carga comum', () => {
  const { state, asteroid, calls, system } = setup({ ore: 0, dilithium: 9 });
  assert.equal(system.mine(), true);
  assert.equal(asteroid.userData.resources['resource:ore-dilithium'].amount, 3);
  assert.equal(state.rawDilithiumOre, 6);
  assert.equal(state.cargo, 0);
  assert.equal(calls.save, 1);
});

test('mineração não altera recursos quando a sessão está inativa', () => {
  const { state, asteroid, calls, system } = setup({ ore: 10, active: false });
  assert.equal(system.mine(), false);
  assert.equal(asteroid.userData.ore, 10);
  assert.equal(state.cargo, 0);
  assert.equal(calls.save, 0);
});
