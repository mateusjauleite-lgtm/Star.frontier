import test from 'node:test';
import assert from 'node:assert/strict';
import { itemDatabase } from '../items/itemDatabase.js';
import { createInventory } from './inventoryCore.js';

test('inventário empilha recursos respeitando limite e remove quantidades', () => {
  const inventory = createInventory({ capacity: 1, registry: itemDatabase });
  assert.deepEqual(inventory.add('resource.ore.common', 1200), { ok: false, reason: 'inventory-full', added: 999, remaining: 201 });
  assert.equal(inventory.count('resource.ore.common'), 999);
  assert.equal(inventory.remove('resource.ore.common', 250).removed, 250);
  assert.equal(inventory.count('resource.ore.common'), 749);
});

test('inventário não cria itens inexistentes e mantém itens únicos em instâncias separadas', () => {
  const inventory = createInventory({ capacity: 4, registry: itemDatabase });
  assert.equal(inventory.add('item.not.registered').reason, 'unknown-item');
  assert.equal(inventory.add('tool.mining_drill.basic', 2).added, 2);
  assert.equal(inventory.items.length, 2);
  assert.notEqual(inventory.items[0].instanceId, inventory.items[1].instanceId);
});
