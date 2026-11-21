import test from 'node:test';
import assert from 'node:assert/strict';
import { createShipShieldSystem } from './shieldSystem.js';

test('escudos absorvem dano antes do casco', () => {
  const state = { shield: 40, hull: 100 };
  const shields = createShipShieldSystem(state);
  const result = shields.applyDamage(25);
  assert.equal(result.absorbed, 25);
  assert.equal(result.hullDamage, 0);
  assert.equal(state.shield, 15);
  assert.equal(state.hull, 100);
});

test('dano excedente atravessa o escudo e atinge o casco', () => {
  const state = { shield: 10, hull: 100 };
  const result = createShipShieldSystem(state).applyDamage(16);
  assert.equal(result.absorbed, 10);
  assert.equal(result.hullDamage, 6);
  assert.equal(state.hull, 94);
});

test('escudos recarregam após o atraso e param na capacidade', () => {
  const state = { shield: 50, hull: 100 };
  const shields = createShipShieldSystem(state, { rechargeDelay: 1, rechargePerSecond: 10 });
  shields.applyDamage(1);
  for (let i = 0; i < 10; i += 1) shields.update(0.1);
  assert.equal(state.shield, 49);
  shields.update(0.1);
  assert.equal(state.shield, 50);
  for (let i = 0; i < 50; i += 1) shields.update(0.1);
  assert.equal(state.shield, 100);
});

test('escudos desligados deixam todo o dano atingir o casco', () => {
  const state = { shield: 50, hull: 100 };
  const shields = createShipShieldSystem(state);
  shields.setEnabled(false);
  const result = shields.applyDamage(12);
  assert.equal(result.absorbed, 0);
  assert.equal(result.hullDamage, 12);
});
