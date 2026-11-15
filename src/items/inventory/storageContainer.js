import { createInventory } from './inventoryCore.js';

export const STORAGE_CONTAINER_TYPES = Object.freeze({
  LOCKER: 'locker',
  CHEST: 'chest'
});

export function createStorageContainer({
  containerId,
  type = STORAGE_CONTAINER_TYPES.CHEST,
  capacity = 24,
  maxWeight = Infinity,
  registry,
  items = []
} = {}) {
  if (typeof containerId !== 'string' || !containerId.trim()) {
    throw new TypeError('containerId obrigatório.');
  }
  if (!Object.values(STORAGE_CONTAINER_TYPES).includes(type)) {
    throw new TypeError('Tipo de armazenamento inválido.');
  }

  const inventory = createInventory({ capacity, maxWeight, registry, items });
  return Object.freeze({
    containerId,
    type,
    inventory,
    snapshot() {
      return {
        containerId,
        type,
        ...inventory.snapshot()
      };
    }
  });
}
