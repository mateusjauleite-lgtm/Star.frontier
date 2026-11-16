import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterEquipmentSystem } from './characterEquipment.js';

function createGameState(overrides = {}) {
  return {
    inventory: {
      items: [],
      overflowItems: [],
      capacity: 24,
      maxWeight: 60,
      equipment: {
        suit: 'Traje de exploração básico',
        helmet: null,
        torso: null,
        gloves: null,
        legs: null,
        boots: null,
        back: null,
        weapon: null,
        tool: null,
        machine: null
      },
      ...overrides
    }
  };
}

function createSystem(gameState = createGameState(), options = {}) {
  return createCharacterEquipmentSystem(gameState, options);
}

test('primeira inicialização migra o traje e equipa uma mochila média', () => {
  const state = createGameState();
  const system = createSystem(state);
  const snapshot = system.initialize();

  assert.equal(system.equippedItem('torso').itemId, 'clothing.field-jacket');
  assert.equal(system.equippedItem('legs').itemId, 'clothing.utility-trousers');
  assert.equal(system.equippedItem('feet').itemId, 'clothing.exploration-boots');
  assert.equal(system.equippedItem('back').itemId, 'equipment.backpack.medium');
  assert.equal(snapshot.capacity, 24);
  assert.equal(state.inventory.equipment.suit, null);
  assert.ok(Array.isArray(state.inventory.overflowItems));
});

test('inventário aceita itens de todas as categorias sem exigir slot de equipamento', () => {
  const system = createSystem();
  system.initialize();
  for (const id of [
    'resource.ore.common',
    'consumable.medkit.basic',
    'tool.mining_drill.basic',
    'machine.portable.fabricator',
    'weapon.phaser',
    'equipment.explorer-helmet'
  ]) {
    assert.equal(system.add(id).ok, true);
  }
  const snapshot = system.snapshot();
  for (const id of [
    'resource.ore.common',
    'consumable.medkit.basic',
    'tool.mining_drill.basic',
    'machine.portable.fabricator',
    'weapon.phaser',
    'equipment.explorer-helmet'
  ]) {
    assert.ok(snapshot.items.some(item => item.definitionId === id));
  }
  const tool = snapshot.items.find(item => item.definitionId === 'tool.mining_drill.basic');
  assert.equal(system.equip(tool.instanceId).ok, false);
  assert.ok(system.snapshot().items.some(item => item.instanceId === tool.instanceId));
});

test('mochilas compacta, média e militar alteram a capacidade', () => {
  const system = createSystem();
  system.initialize();
  system.add('equipment.compact-backpack');
  system.add('equipment.backpack.military');

  let bag = system.snapshot().items.find(item => item.definitionId === 'equipment.compact-backpack');
  assert.equal(system.equip(bag.instanceId).ok, true);
  assert.equal(system.snapshot().capacity, 12);

  bag = system.snapshot().items.find(item => item.definitionId === 'equipment.backpack.military');
  assert.equal(system.equip(bag.instanceId).ok, true);
  assert.equal(system.snapshot().capacity, 40);
  assert.equal(system.equippedItem('back').definitionId, 'equipment.backpack.military');
});

test('trocar para mochila menor preserva excedentes e mochila maior os recupera', () => {
  const system = createSystem(createGameState({ maxWeight: 100 }));
  system.initialize();
  system.add('tool.mining_drill.basic', 14);
  system.add('equipment.compact-backpack');
  let bag = system.snapshot().items.find(item => item.definitionId === 'equipment.compact-backpack');
  const toolIds = system.snapshot().items
    .filter(item => item.definitionId === 'tool.mining_drill.basic')
    .map(item => item.instanceId);

  assert.equal(system.equip(bag.instanceId).ok, true);
  assert.equal(system.snapshot().capacity, 12);
  assert.equal(system.snapshot().overflowItems.length, 6);

  system.add('equipment.backpack.medium');
  bag = system.snapshot().overflowItems.find(item => item.definitionId === 'equipment.backpack.medium');
  assert.ok(bag);
  assert.equal(system.equip(bag.instanceId).ok, true);
  const restored = system.snapshot();
  assert.equal(restored.capacity, 24);
  assert.equal(restored.overflowItems.length, 0);
  assert.deepEqual(
    restored.items.filter(item => item.definitionId === 'tool.mining_drill.basic').map(item => item.instanceId).sort(),
    toolIds.sort()
  );
});

test('desequipar mochila devolve a mesma instância e reduz a capacidade com segurança', () => {
  const system = createSystem();
  system.initialize();
  const backpack = system.equippedItem('back');
  const result = system.unequip('back');
  assert.equal(result.ok, true);
  assert.equal(result.item.instanceId, backpack.instanceId);
  assert.equal(system.snapshot().capacity, 12);
  assert.ok(system.snapshot().items.some(item => item.instanceId === backpack.instanceId));
});

test('itens legados mantêm IDs e slots; itens desconhecidos são preservados', () => {
  const state = createGameState({
    items: [
      { instanceId: 'legacy-jacket-1', itemId: 'clothing.field-jacket', name: 'Jaqueta de campo', category: 'clothing', quantity: 1 },
      { instanceId: 'legacy-module-1', itemId: 'old.module.experimental', name: 'Módulo antigo', category: 'equipment', quantity: 1 }
    ],
    equipment: {
      suit: 'Traje de exploração básico',
      helmet: 'equipment.explorer-helmet',
      back: 'equipment.compact-backpack',
      tool: null,
      machine: null
    }
  });
  const system = createSystem(state);
  system.initialize();

  assert.equal(system.equippedItem('head').itemId, 'equipment.explorer-helmet');
  assert.equal(system.equippedItem('back').itemId, 'equipment.compact-backpack');
  assert.equal(system.equippedItem('torso').instanceId, 'legacy-jacket-1');
  const unknown = [...system.snapshot().items, ...system.snapshot().overflowItems]
    .find(item => item.instanceId === 'legacy-module-1');
  assert.ok(unknown);
  assert.equal(unknown.name, 'Módulo antigo');
  assert.equal(unknown.definitionId, 'legacy.unknown');
});

test('equipamento incompatível em slot legado não é descartado', () => {
  const state = createGameState({
    equipment: {
      suit: null,
      helmet: {
        instanceId: 'legacy-invalid-head',
        itemId: 'old.helmet.prototype',
        name: 'Capacete protótipo',
        quantity: 1
      }
    }
  });
  const system = createSystem(state);
  system.initialize();
  const preserved = system.snapshot().overflowItems.find(item => item.instanceId === 'legacy-invalid-head');
  assert.ok(preserved);
  assert.equal(preserved.name, 'Capacete protótipo');
});

test('armazenamento temporário permite restaurar itens e equipar mochila mesmo sem espaço', () => {
  const system = createSystem(createGameState({ maxWeight: 200 }));
  system.initialize();
  system.add('tool.mining_drill.basic', 30);
  system.add('equipment.backpack.military');
  const bag = system.snapshot().overflowItems.find(item => item.definitionId === 'equipment.backpack.military');
  assert.ok(bag);
  assert.equal(system.equip(bag.instanceId).ok, true);
  assert.equal(system.snapshot().capacity, 40);
  assert.equal(system.snapshot().overflowItems.length, 0);
});

test('snapshot persistido inclui IDs, capacidade, peso e excedentes', () => {
  const state = createGameState();
  const system = createSystem(state);
  system.initialize();
  system.add('tool.mining_drill.basic', 30);
  const snapshot = system.snapshot();
  assert.equal(state.inventory.capacity, snapshot.capacity);
  assert.equal(state.inventory.items.length, snapshot.items.length);
  assert.equal(state.inventory.overflowItems.length, snapshot.overflowItems.length);
  assert.ok(state.inventory.items.every(item => item.instanceId && item.definitionId && item.itemId));
});
