import test from 'node:test';
import assert from 'node:assert/strict';
import { itemDatabase } from '../itemDatabase.js';
import { createInventory } from './inventoryCore.js';
import { createStorageContainer } from './storageContainer.js';
import { transferInventoryInstance } from './inventoryTransfer.js';

test('container de armazenamento reutiliza o inventário oficial', () => {
  const locker = createStorageContainer({
    containerId: 'locker-test-01',
    type: 'locker',
    capacity: 8,
    registry: itemDatabase
  });
  assert.equal(locker.type, 'locker');
  assert.equal(locker.inventory.capacity, 8);
  assert.deepEqual(locker.snapshot().items, []);
});

test('transferência move a instância sem recriar ou duplicar seu ID', () => {
  const player = createInventory({ capacity: 8, registry: itemDatabase });
  const locker = createStorageContainer({
    containerId: 'locker-test-02',
    capacity: 8,
    registry: itemDatabase
  });
  player.add('tool.mining_drill.basic', 1);
  const original = player.items[0];

  const result = transferInventoryInstance(player, locker.inventory, original.instanceId);

  assert.equal(result.ok, true);
  assert.equal(player.items.length, 0);
  assert.equal(locker.inventory.items.length, 1);
  assert.equal(locker.inventory.items[0].instanceId, original.instanceId);
  assert.equal(locker.inventory.items[0].definitionId, original.definitionId);
});

test('transferência recusada mantém o item na origem', () => {
  const player = createInventory({ capacity: 8, registry: itemDatabase });
  const fullLocker = createInventory({ capacity: 1, registry: itemDatabase });
  player.add('tool.mining_drill.basic', 1);
  fullLocker.add('tool.mining_drill.basic', 1);
  const instanceId = player.items[0].instanceId;

  const result = transferInventoryInstance(player, fullLocker, instanceId);

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'inventory-full');
  assert.equal(player.items[0].instanceId, instanceId);
  assert.equal(fullLocker.items.length, 1);
});
