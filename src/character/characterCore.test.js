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


test('equipar item ocupa slot compatível e devolve equipamento anterior à mochila',()=>{const c=createTestCharacter();c.addItem('tool.mining_drill.basic');c.addItem('tool.scanner.portable');const [drill,scanner]=c.getInventorySnapshot().items;assert.equal(c.equipItem(drill.instanceId).ok,true);const r=c.equipItem(scanner.instanceId);assert.equal(r.ok,true);assert.equal(r.slot,'tool');assert.equal(c.getEquippedItem('tool').definitionId,'tool.scanner.portable');assert.equal(c.hasItem('tool.mining_drill.basic'),true);});
test('guardar equipamento devolve a mesma instância ao inventário',()=>{const c=createTestCharacter();c.addItem('tool.mining_drill.basic');const drill=c.getInventorySnapshot().items[0];c.equipItem(drill.instanceId);const r=c.unequipItem('tool');assert.equal(r.ok,true);assert.equal(r.returned.instanceId,drill.instanceId);assert.equal(c.hasItem('tool.mining_drill.basic'),true);});
test('códigos de catálogo identificam itens sem substituir o ID técnico',()=>{assert.equal(itemDatabase.getByCode('B-001').id,'tool.mining_drill.basic');assert.equal(itemDatabase.getByCode('P-001').category,'weapon');});


test('snapshot restaura também os equipamentos já vestidos',()=>{const original=createTestCharacter();original.addItem('equipment.suit.explorer.basic');const suit=original.getInventorySnapshot().items[0];original.equipItem(suit.instanceId);const restored=createTestCharacter(original.getInventorySnapshot());assert.equal(restored.getEquippedItem('suit').definitionId,'equipment.suit.explorer.basic');assert.equal(restored.hasItem('equipment.suit.explorer.basic'),false);});
