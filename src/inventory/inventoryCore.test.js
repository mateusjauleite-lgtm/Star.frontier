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

test('inventário não cria itens inexistentes nem empilha itens únicos', () => {
  const inventory = createInventory({ capacity: 4, registry: itemDatabase });
  assert.equal(inventory.add('item.not.registered').reason, 'unknown-item');
  assert.equal(inventory.add('tool.mining_drill.basic', 2).added, 1);
  assert.equal(inventory.items.length, 1);
});
