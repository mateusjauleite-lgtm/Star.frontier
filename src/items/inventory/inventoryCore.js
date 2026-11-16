import { createItemInstance, cloneItemInstance } from '../itemInstances.js';
import { validateItemInstance } from '../itemValidation.js';

function copyInstance(instance) {
  return cloneItemInstance(instance);
}

function getInstanceWeight(instance, registry) {
  return (registry.get(instance.definitionId)?.weight ?? 0) * instance.quantity;
}

function validCapacity(value) {
  return Number.isSafeInteger(value) && value >= 1;
}

export function createInventory({
  capacity = 24,
  maxWeight = Infinity,
  registry,
  items = [],
  overflowItems = []
} = {}) {
  if (!registry || typeof registry.get !== 'function') throw new TypeError('Item registry obrigatório.');
  if (maxWeight === null) maxWeight = Infinity;
  if (!validCapacity(capacity)) throw new RangeError('capacity deve ser um inteiro positivo.');
  if (maxWeight !== Infinity && (typeof maxWeight !== 'number' || !Number.isFinite(maxWeight) || maxWeight < 0)) {
    throw new RangeError('maxWeight deve ser não negativo ou Infinity.');
  }
  if (!Array.isArray(items) || !Array.isArray(overflowItems)) throw new TypeError('items e overflowItems devem ser listas.');

  const slots = [];
  const overflow = [];
  const instanceIds = new Set();
  const allInitialItems = [...items, ...overflowItems];

  for (const item of allInitialItems) {
    const definition = registry.get(item?.definitionId);
    const errors = validateItemInstance(item, definition);
    if (errors.length) throw new TypeError(errors.join(' '));
    if (instanceIds.has(item.instanceId)) throw new Error(`instanceId duplicado: ${item.instanceId}`);
    instanceIds.add(item.instanceId);

    const copy = copyInstance(item);
    const usedWeight = slots.reduce((sum, entry) => sum + getInstanceWeight(entry, registry), 0);
    if (slots.length < capacity && usedWeight + getInstanceWeight(copy, registry) <= maxWeight) {
      slots.push(copy);
    } else {
      overflow.push(copy);
    }
  }

  const usedWeightOf = entries => entries.reduce((sum, item) => sum + getInstanceWeight(item, registry), 0);
  const allHasId = id => slots.some(item => item.instanceId === id) || overflow.some(item => item.instanceId === id);

  const inventory = {
    get capacity() { return capacity; },
    get maxWeight() { return maxWeight; },
    get usedWeight() { return usedWeightOf(slots); },
    get remainingWeight() { return maxWeight === Infinity ? Infinity : Math.max(0, maxWeight - this.usedWeight); },
    get items() { return slots.map(copyInstance); },
    get overflowItems() { return overflow.map(copyInstance); },
    get size() { return slots.length; },
    get overflowSize() { return overflow.length; },
    count(definitionId) {
      return [...slots, ...overflow].filter(item => item.definitionId === definitionId)
        .reduce((sum, item) => sum + item.quantity, 0);
    },
    has(definitionId, quantity = 1) {
      return Number.isSafeInteger(quantity) && quantity > 0 && this.count(definitionId) >= quantity;
    },
    canAdd(definitionId, quantity = 1, options = {}) {
      const definition = registry.get(definitionId);
      if (!definition) return { ok: false, reason: 'unknown-item' };
      if (!Number.isSafeInteger(quantity) || quantity < 1) return { ok: false, reason: 'invalid-quantity' };
      if (definition.weight * quantity > this.remainingWeight) return { ok: false, reason: 'weight-limit' };
      const durability = options.durability ?? definition.attributes?.durability ?? null;
      const metadata = options.metadata ?? {};
      let freeStackSpace = 0;
      if (definition.stackable) {
        for (const slot of slots) {
          if (slot.definitionId === definitionId && slot.durability === durability &&
              JSON.stringify(slot.metadata) === JSON.stringify(metadata)) {
            freeStackSpace += definition.maxStack - slot.quantity;
          }
        }
      }
      const neededSlots = definition.stackable
        ? Math.ceil(Math.max(0, quantity - freeStackSpace) / definition.maxStack)
        : quantity;
      return slots.length + neededSlots <= capacity
        ? { ok: true, reason: null }
        : { ok: false, reason: 'inventory-full' };
    },
    add(definitionId, quantity = 1, options = {}) {
      const definition = registry.get(definitionId);
      if (!definition) return { ok: false, reason: 'unknown-item', added: 0, remaining: quantity };
      if (!Number.isSafeInteger(quantity) || quantity < 1) return { ok: false, reason: 'invalid-quantity', added: 0, remaining: quantity };
      if (!options || typeof options !== 'object' || Array.isArray(options)) return { ok: false, reason: 'invalid-options', added: 0, remaining: quantity };
      const durability = options.durability ?? definition.attributes?.durability ?? null;
      const metadata = options.metadata ?? {};
      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return { ok: false, reason: 'invalid-metadata', added: 0, remaining: quantity };
      if (durability !== null && (typeof durability !== 'number' || !Number.isFinite(durability) || durability < 0)) return { ok: false, reason: 'invalid-durability', added: 0, remaining: quantity };
      if (options.instanceId !== undefined && (typeof options.instanceId !== 'string' || !options.instanceId.trim())) return { ok: false, reason: 'invalid-instance-id', added: 0, remaining: quantity };
      if (options.instanceId && allHasId(options.instanceId)) return { ok: false, reason: 'duplicate-instance-id', added: 0, remaining: quantity };

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

      let customInstanceIdUsed = false;
      while (toAdd > 0 && slots.length < capacity) {
        const amount = definition.stackable ? Math.min(toAdd, definition.maxStack) : 1;
        const instanceOptions = { ...options, quantity: amount };
        if (customInstanceIdUsed) delete instanceOptions.instanceId;
        else if (options.instanceId) customInstanceIdUsed = true;
        slots.push(createItemInstance(definition, instanceOptions));
        toAdd -= amount;
        remaining -= amount;
      }

      const added = quantity - remaining;
      const reason = remaining
        ? (weightLimitedQuantity < quantity && slots.length < capacity ? 'weight-limit' : 'inventory-full')
        : null;
      return { ok: remaining === 0, reason, added, remaining };
    },
    remove(definitionId, quantity = 1) {
      if (!Number.isSafeInteger(quantity) || quantity < 1) return { ok: false, reason: 'invalid-quantity', removed: 0, remaining: quantity };
      let remaining = quantity;
      for (const collection of [slots, overflow]) {
        for (let i = collection.length - 1; i >= 0 && remaining > 0; i--) {
          const slot = collection[i];
          if (slot.definitionId !== definitionId) continue;
          const amount = Math.min(remaining, slot.quantity);
          slot.quantity -= amount;
          remaining -= amount;
          if (slot.quantity === 0) collection.splice(i, 1);
        }
      }
      return { ok: remaining === 0, reason: remaining ? 'insufficient-items' : null, removed: quantity - remaining, remaining };
    },
    addToOverflow(definitionId, quantity = 1, options = {}) {
      const definition = registry.get(definitionId);
      if (!definition) return { ok: false, reason: 'unknown-item', added: 0, remaining: quantity };
      if (!Number.isSafeInteger(quantity) || quantity < 1) return { ok: false, reason: 'invalid-quantity', added: 0, remaining: quantity };
      if (!options || typeof options !== 'object' || Array.isArray(options)) return { ok: false, reason: 'invalid-options', added: 0, remaining: quantity };
      const durability = options.durability ?? definition.attributes?.durability ?? null;
      const metadata = options.metadata ?? {};
      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return { ok: false, reason: 'invalid-metadata', added: 0, remaining: quantity };
      if (durability !== null && (typeof durability !== 'number' || !Number.isFinite(durability) || durability < 0)) return { ok: false, reason: 'invalid-durability', added: 0, remaining: quantity };
      if (options.instanceId !== undefined && (typeof options.instanceId !== 'string' || !options.instanceId.trim())) return { ok: false, reason: 'invalid-instance-id', added: 0, remaining: quantity };
      if (options.instanceId && allHasId(options.instanceId)) return { ok: false, reason: 'duplicate-instance-id', added: 0, remaining: quantity };
      let remaining = quantity;
      let customInstanceIdUsed = false;
      while (remaining > 0) {
        const amount = definition.stackable ? Math.min(remaining, definition.maxStack) : 1;
        const instanceOptions = { ...options, quantity: amount };
        if (customInstanceIdUsed) delete instanceOptions.instanceId;
        else if (options.instanceId) customInstanceIdUsed = true;
        overflow.push(createItemInstance(definition, instanceOptions));
        remaining -= amount;
      }
      return { ok: true, reason: null, added: quantity, remaining: 0, storedInOverflow: true };
    },
    addWithOverflow(definitionId, quantity = 1, options = {}) {
      const result = this.add(definitionId, quantity, options);
      if (result.remaining <= 0 || !['inventory-full', 'weight-limit'].includes(result.reason)) return result;
      const overflowOptions = { ...options };
      if (result.added > 0) delete overflowOptions.instanceId;
      const overflowResult = this.addToOverflow(definitionId, result.remaining, overflowOptions);
      const added = result.added + (overflowResult.added || 0);
      const remaining = quantity - added;
      return {
        ok: remaining === 0,
        reason: remaining ? overflowResult.reason : null,
        added,
        remaining,
        storedInOverflow: (overflowResult.added || 0) > 0
      };
    },
    addInstance(instance) {
      const definition = registry.get(instance?.definitionId);
      const errors = validateItemInstance(instance, definition);
      if (errors.length) return { ok: false, reason: 'invalid-instance', errors };
      if (allHasId(instance.instanceId)) return { ok: false, reason: 'duplicate-instance-id' };
      if (slots.length >= capacity) return { ok: false, reason: 'inventory-full' };
      if (getInstanceWeight(instance, registry) > this.remainingWeight) return { ok: false, reason: 'weight-limit' };
      slots.push(copyInstance(instance));
      return { ok: true, reason: null, instanceId: instance.instanceId };
    },
    addOverflowInstance(instance) {
      const definition = registry.get(instance?.definitionId);
      const errors = validateItemInstance(instance, definition);
      if (errors.length) return { ok: false, reason: 'invalid-instance', errors };
      if (allHasId(instance.instanceId)) return { ok: false, reason: 'duplicate-instance-id' };
      overflow.push(copyInstance(instance));
      return { ok: true, reason: null, instanceId: instance.instanceId, storedInOverflow: true };
    },
    removeInstance(instanceId) {
      for (const collection of [slots, overflow]) {
        const index = collection.findIndex(item => item.instanceId === instanceId);
        if (index >= 0) return copyInstance(collection.splice(index, 1)[0]);
      }
      return null;
    },
    moveOverflowToInventory(instanceId) {
      const index = overflow.findIndex(entry => entry.instanceId === instanceId);
      if (index < 0) return { ok: false, reason: 'instance-not-in-overflow' };
      const [item] = overflow.splice(index, 1);
      const inserted = this.addInstance(item);
      if (!inserted.ok) {
        overflow.splice(index, 0, item);
        return inserted;
      }
      return { ok: true, reason: null, instanceId };
    },
    setCapacity(nextCapacity) {
      if (!validCapacity(nextCapacity)) return { ok: false, reason: 'invalid-capacity' };
      capacity = nextCapacity;
      while (slots.length > capacity) overflow.unshift(slots.pop());
      while (overflow.length && slots.length < capacity) {
        const index = overflow.findIndex(item =>
          this.usedWeight + getInstanceWeight(item, registry) <= maxWeight
        );
        if (index < 0) break;
        slots.push(overflow.splice(index, 1)[0]);
      }
      return { ok: true, capacity, overflowCount: overflow.length };
    },
    setMaxWeight(nextMaxWeight) {
      if (nextMaxWeight !== Infinity && (typeof nextMaxWeight !== 'number' || !Number.isFinite(nextMaxWeight) || nextMaxWeight < 0)) {
        return { ok: false, reason: 'invalid-max-weight' };
      }
      maxWeight = nextMaxWeight;
      while (slots.length && this.usedWeight > maxWeight) overflow.unshift(slots.pop());
      while (overflow.length && slots.length < capacity) {
        const index = overflow.findIndex(item =>
          this.usedWeight + getInstanceWeight(item, registry) <= maxWeight
        );
        if (index < 0) break;
        slots.push(overflow.splice(index, 1)[0]);
      }
      return { ok: true, maxWeight, overflowCount: overflow.length };
    },
    clear() {
      slots.length = 0;
      overflow.length = 0;
    },
    snapshot() {
      return {
        capacity,
        maxWeight: maxWeight === Infinity ? null : maxWeight,
        items: this.items,
        overflowItems: this.overflowItems
      };
    }
  };

  return inventory;
}
