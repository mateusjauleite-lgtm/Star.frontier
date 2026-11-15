import { createItemInstance, cloneItemInstance } from '../itemInstances.js';
import { validateItemInstance } from '../itemValidation.js';

function copyInstance(instance) {
  return cloneItemInstance(instance);
}

function getInstanceWeight(instance, registry) {
  return registry.get(instance.definitionId).weight * instance.quantity;
}

export function createInventory({ capacity = 24, maxWeight = Infinity, registry, items = [] } = {}) {
  if (!registry || typeof registry.get !== 'function') throw new TypeError('Item registry obrigatório.');
  if (!Number.isSafeInteger(capacity) || capacity < 1) throw new RangeError('capacity deve ser um inteiro positivo.');
  if (maxWeight !== Infinity && (typeof maxWeight !== 'number' || !Number.isFinite(maxWeight) || maxWeight < 0)) throw new RangeError('maxWeight deve ser não negativo ou Infinity.');
  if (!Array.isArray(items)) throw new TypeError('items deve ser uma lista.');

  const slots = [];
  const instanceIds = new Set();
  for (const item of items) {
    const definition = registry.get(item?.definitionId);
    const errors = validateItemInstance(item, definition);
    if (errors.length) throw new TypeError(errors.join(' '));
    if (instanceIds.has(item.instanceId)) throw new Error(`instanceId duplicado: ${item.instanceId}`);
    instanceIds.add(item.instanceId);
    slots.push(copyInstance(item));
  }
  if (slots.length > capacity) throw new RangeError('Os itens iniciais excedem a capacidade de slots.');
  if (slots.reduce((sum, item) => sum + getInstanceWeight(item, registry), 0) > maxWeight) throw new RangeError('Os itens iniciais excedem o peso máximo.');

  const inventory = {
    get capacity() { return capacity; },
    get maxWeight() { return maxWeight; },
    get usedWeight() { return slots.reduce((sum, item) => sum + getInstanceWeight(item, registry), 0); },
    get remainingWeight() { return maxWeight === Infinity ? Infinity : Math.max(0, maxWeight - this.usedWeight); },
    get items() { return slots.map(copyInstance); },
    get size() { return slots.length; },
    count(definitionId) { return slots.filter(item => item.definitionId === definitionId).reduce((sum, item) => sum + item.quantity, 0); },
    has(definitionId, quantity = 1) { return Number.isSafeInteger(quantity) && quantity > 0 && this.count(definitionId) >= quantity; },
    canAdd(definitionId, quantity = 1) {
      const definition = registry.get(definitionId);
      if (!definition) return { ok: false, reason: 'unknown-item' };
      if (!Number.isSafeInteger(quantity) || quantity < 1) return { ok: false, reason: 'invalid-quantity' };
      if (definition.weight * quantity > this.remainingWeight) return { ok: false, reason: 'weight-limit' };
      let freeStackSpace = 0;
      if (definition.stackable) {
        for (const slot of slots) if (slot.definitionId === definitionId) freeStackSpace += definition.maxStack - slot.quantity;
      }
      const neededSlots = definition.stackable ? Math.ceil(Math.max(0, quantity - freeStackSpace) / definition.maxStack) : quantity;
      return slots.length + neededSlots <= capacity ? { ok: true, reason: null } : { ok: false, reason: 'inventory-full' };
    },
    add(definitionId, quantity = 1, options = {}) {
      const definition = registry.get(definitionId);
      if (!definition) return { ok: false, reason: 'unknown-item', added: 0, remaining: quantity };
      if (!Number.isSafeInteger(quantity) || quantity < 1) return { ok: false, reason: 'invalid-quantity', added: 0, remaining: quantity };
      if (!options || typeof options !== 'object' || Array.isArray(options)) return { ok: false, reason: 'invalid-options', added: 0, remaining: quantity };
      const durability = options.durability ?? definition.attributes?.durability ?? null;
      const metadata = options.metadata ?? {};
      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return { ok: false, reason: 'invalid-metadata', added: 0, remaining: quantity };
      const weightLimitedQuantity = definition.weight > 0 && maxWeight !== Infinity
        ? Math.floor(this.remainingWeight / definition.weight)
        : quantity;
      let remaining = quantity;
      let toAdd = Math.min(quantity, weightLimitedQuantity);
      if (definition.stackable) {
        for (const slot of slots) {
          if (slot.definitionId !== definitionId || slot.quantity >= definition.maxStack) continue;
          if (slot.durability !== durability || JSON.stringify(slot.metadata) !== JSON.stringify(metadata)) continue;
          const amount = Math.min(toAdd, definition.maxStack - slot.quantity);
          slot.quantity += amount;
          toAdd -= amount;
          remaining -= amount;
          if (!toAdd) break;
        }
      }
      while (toAdd > 0 && slots.length < capacity) {
        const amount = definition.stackable ? Math.min(toAdd, definition.maxStack) : 1;
        slots.push(createItemInstance(definition, { ...options, quantity: amount }));
        toAdd -= amount;
        remaining -= amount;
      }
      const added = quantity - remaining;
      const reason = remaining ? (weightLimitedQuantity < quantity ? 'weight-limit' : 'inventory-full') : null;
      return { ok: remaining === 0, reason, added, remaining };
    },
    remove(definitionId, quantity = 1) {
      if (!Number.isSafeInteger(quantity) || quantity < 1) return { ok: false, reason: 'invalid-quantity', removed: 0, remaining: quantity };
      let remaining = quantity;
      for (let i = slots.length - 1; i >= 0 && remaining > 0; i--) {
        const slot = slots[i];
        if (slot.definitionId !== definitionId) continue;
        const amount = Math.min(remaining, slot.quantity);
        slot.quantity -= amount;
        remaining -= amount;
        if (slot.quantity === 0) slots.splice(i, 1);
      }
      return { ok: remaining === 0, reason: remaining ? 'insufficient-items' : null, removed: quantity - remaining, remaining };
    },
    removeInstance(instanceId) {
      const index = slots.findIndex(item => item.instanceId === instanceId);
      if (index < 0) return null;
      return copyInstance(slots.splice(index, 1)[0]);
    },
    clear() { slots.length = 0; },
    snapshot() { return { capacity, maxWeight: maxWeight === Infinity ? null : maxWeight, items: this.items }; }
  };
  return inventory;
}
