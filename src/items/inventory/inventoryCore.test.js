import test from 'node:test';
import assert from 'node:assert/strict';
import { itemDatabase } from '../itemDatabase.js';
import { createItemInstance } from '../itemInstances.js';
import { createInventory } from './inventoryCore.js';

test('instâncias recebem UUIDs distintos e preservam IDs de definição estáveis', () => {
  const definition = itemDatabase.get('tool.mining_drill.basic');
  const first = createItemInstance(definition);
  const second = createItemInstance(definition);
  assert.equal(first.definitionId, 'tool.mining_drill.basic');
  assert.notEqual(first.instanceId, second.instanceId);
  assert.match(first.instanceId, /^[0-9a-f-]{36}$/i);
});

test('validação rejeita quantidade, durabilidade e metadados inválidos', () => {
  const definition = itemDatabase.get('resource.ore.common');
  assert.throws(() => createItemInstance(definition, { quantity: 0 }), /Quantidade/);
  assert.throws(() => createItemInstance(definition, { durability: -1 }), /Durabilidade/);
  assert.throws(() => createItemInstance(definition, { metadata: [] }), /metadata/);
});

test('inventário controla slots, empilhamento e remoção parcial', () => {
  const inventory = createInventory({ capacity: 1, registry: itemDatabase });
  assert.deepEqual(inventory.add('resource.ore.common', 1200), { ok: false, reason: 'inventory-full', added: 999, remaining: 201 });
  assert.equal(inventory.count('resource.ore.common'), 999);
  assert.equal(inventory.usedWeight, 499.5);
  assert.equal(inventory.remove('resource.ore.common', 250).removed, 250);
  assert.equal(inventory.count('resource.ore.common'), 749);
});

test('inventário aplica limite de peso também ao empilhar', () => {
  const inventory = createInventory({ capacity: 5, maxWeight: 10, registry: itemDatabase });
  const result = inventory.add('resource.ore.common', 30);
  assert.deepEqual(result, { ok: false, reason: 'weight-limit', added: 20, remaining: 10 });
  assert.equal(inventory.usedWeight, 10);
});

test('inventário rejeita definições desconhecidas e IDs de instância repetidos', () => {
  const inventory = createInventory({ capacity: 4, registry: itemDatabase });
  assert.equal(inventory.add('item.not.registered').reason, 'unknown-item');
  const item = createItemInstance(itemDatabase.get('tool.mining_drill.basic'));
  assert.throws(() => createInventory({ registry: itemDatabase, items: [item, item] }), /instanceId duplicado/);
});

test('inventário não mistura pilhas com metadados diferentes', () => {
  const inventory = createInventory({ capacity: 3, registry: itemDatabase });
  inventory.add('resource.ore.common', 2, { metadata: { source: 'mine-a' } });
  inventory.add('resource.ore.common', 2, { metadata: { source: 'mine-b' } });
  assert.equal(inventory.items.length, 2);
});
