import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterCore } from './characterCore.js';
import { itemDatabase } from '../items/itemDatabase.js';

function createTestCharacter(snapshot) {
  return createCharacterCore({}, {
    itemRegistry: itemDatabase,
    inventorySnapshot: snapshot,
    inventoryCapacity: 4,
    inventoryMaxWeight: 20
  });
}

test('personagem possui inventário próprio e adiciona itens do catálogo', () => {
  const character = createTestCharacter();
  const result = character.addItem('consumable.medkit.basic', 3);
  assert.equal(result.ok, true);
  assert.equal(character.hasItem('consumable.medkit.basic', 3), true);
  assert.equal(character.getInventorySnapshot().items[0].quantity, 3);
});

test('inventários de personagens diferentes não compartilham itens', () => {
  const first = createTestCharacter();
  const second = createTestCharacter();
  first.addItem('resource.ore.common', 5);
  assert.equal(first.hasItem('resource.ore.common', 5), true);
  assert.equal(second.hasItem('resource.ore.common'), false);
});

test('snapshot restaura inventário e remoção parcial mantém a pilha', () => {
  const original = createTestCharacter();
  original.addItem('consumable.medkit.basic', 4);
  const restored = createTestCharacter(original.getInventorySnapshot());
  const result = restored.removeItem('consumable.medkit.basic', 2);
  assert.equal(result.removed, 2);
  assert.equal(restored.getInventorySnapshot().items[0].quantity, 2);
});

test('reset do personagem não apaga seus pertences', () => {
  const character = createTestCharacter();
  character.addItem('tool.scanner.portable');
  character.reset();
  assert.equal(character.hasItem('tool.scanner.portable'), true);
});
