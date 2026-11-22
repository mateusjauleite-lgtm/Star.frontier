import test from 'node:test';
import assert from 'node:assert/strict';
import { createMiningRuntimeSystem } from './miningSystem.js';
import { RESOURCE_IDS } from '../core/resources/resourceCatalog.js';

function setup({ ore = 10, dilithium = 0, active = true, refinerySpace = 200 } = {}) {
  const state = { cargo: 0, ore: 0, miningDrill: 'Broca padrão' };
  const asteroid = {
    position: { distanceTo: () => 5 },
    userData: {
      ore,
      resources: dilithium ? { [RESOURCE_IDS.DILITHIUM_ORE]: { amount: dilithium, purity: 0.9 } } : {}
    },
    children: []
  };
  const calls = { save: 0, wallet: 0, audio: 0, messages: [], refineryOre: 0 };
  const system = createMiningRuntimeSystem({
    state,
    isActive: () => active,
    getAsteroids: () => [asteroid],
    getShip: () => ({ position: {} }),
    setAsteroids() {},
    save: () => calls.save++,
    updateWallet: () => calls.wallet++,
    shipAudio: { playMining: () => calls.audio++ },
    toast: message => calls.messages.push(message),
    receiveDilithiumOre: quantity => {
      const added = Math.min(quantity, refinerySpace - calls.refineryOre);
      calls.refineryOre += added;
      return { added };
    }
  });
  return { state, asteroid, calls, system };
}

test('mineração comum continua alimentando a carga genérica', () => {
  const { state, asteroid, calls, system } = setup({ ore: 10 });
  assert.equal(system.mine(), true);
  assert.equal(asteroid.userData.ore, 4);
  assert.equal(state.ore, 6);
  assert.equal(state.cargo, 6);
  assert.equal(calls.save, 1);
});

test('minério de dilítio minerado pela nave vai direto ao estoque da refinaria', () => {
  const { state, asteroid, calls, system } = setup({ ore: 0, dilithium: 9 });
  assert.equal(system.mine(), true);
  assert.equal(asteroid.userData.resources[RESOURCE_IDS.DILITHIUM_ORE].amount, 3);
  assert.equal(calls.refineryOre, 6);
  assert.equal(state.cargo, 0);
  assert.equal(state.ore, 0);
  assert.equal(calls.save, 1);
  assert.match(calls.messages[0], /diretamente à Refinaria/);
});

test('refinaria cheia não consome o depósito de dilítio', () => {
  const { asteroid, calls, system } = setup({ ore: 0, dilithium: 9, refinerySpace: 0 });
  assert.equal(system.mine(), false);
  assert.equal(asteroid.userData.resources[RESOURCE_IDS.DILITHIUM_ORE].amount, 9);
  assert.equal(calls.refineryOre, 0);
  assert.equal(calls.save, 0);
});

test('mineração aceita somente a capacidade restante da refinaria', () => {
  const { asteroid, calls, system } = setup({ ore: 0, dilithium: 9, refinerySpace: 2 });
  assert.equal(system.mine(), true);
  assert.equal(asteroid.userData.resources[RESOURCE_IDS.DILITHIUM_ORE].amount, 7);
  assert.equal(calls.refineryOre, 2);
});

test('mineração não altera recursos quando a sessão está inativa', () => {
  const { state, asteroid, calls, system } = setup({ ore: 10, active: false });
  assert.equal(system.mine(), false);
  assert.equal(asteroid.userData.ore, 10);
  assert.equal(state.cargo, 0);
  assert.equal(calls.save, 0);
});
