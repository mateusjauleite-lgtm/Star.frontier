import test from 'node:test';
import assert from 'node:assert/strict';
import { loadInventory, saveInventory, INVENTORY_STORAGE_KEY } from './inventoryStorage.js';

test('persistência salva e recupera capacidade, peso e itens', () => {
  const values = new Map();
  const storage = {
    setItem(key, value) { values.set(key, value); },
    getItem(key) { return values.get(key) ?? null; }
  };
  const inventory = { snapshot: () => ({ capacity: 12, maxWeight: 80, items: [{ instanceId: 'unit-1' }] }) };
  assert.equal(saveInventory(inventory, storage), true);
  assert.equal(INVENTORY_STORAGE_KEY, 'sf-inventory-v1');
  assert.deepEqual(loadInventory(storage), { capacity: 12, maxWeight: 80, items: [{ instanceId: 'unit-1' }] });
});

test('persistência trata ausência de dados e JSON inválido', () => {
  const storage = { getItem: () => '{invalid' };
  assert.equal(loadInventory(storage), null);
  assert.equal(saveInventory({}, storage), false);
});
