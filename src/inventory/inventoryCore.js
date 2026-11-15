import { createItemInstance } from '../items/itemInstances.js';

export function createInventory({ capacity = 24, registry, items = [] } = {}) {
  if (!registry) throw new TypeError('Item registry obrigatório.');
  const slots = items.map(item => ({ ...item, metadata: { ...(item.metadata ?? {}) } }));
  const inventory = {
    get capacity() { return capacity; },
    get items() { return slots.map(item => ({ ...item, metadata: { ...(item.metadata ?? {}) } })); },
    count(definitionId) { return slots.filter(item => item.definitionId === definitionId).reduce((sum, item) => sum + item.quantity, 0); },
    add(definitionId, quantity = 1, options = {}) {
      const definition = registry.get(definitionId);
      if (!definition) return { ok: false, reason: 'unknown-item', added: 0 };
      if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, reason: 'invalid-quantity', added: 0 };
      let remaining = quantity;
      if (definition.stackable) {
        for (const slot of slots) {
          if (slot.definitionId !== definitionId || slot.quantity >= definition.maxStack) continue;
          const amount = Math.min(remaining, definition.maxStack - slot.quantity);
          slot.quantity += amount; remaining -= amount;
          if (!remaining) break;
        }
      }
      while (remaining > 0 && slots.length < capacity) {
        const amount = definition.stackable ? Math.min(remaining, definition.maxStack) : 1;
        slots.push(createItemInstance(definition, { ...options, quantity: amount }));
        remaining -= amount;
      }
      return { ok: remaining === 0, reason: remaining ? 'inventory-full' : null, added: quantity - remaining, remaining };
    },
    remove(definitionId, quantity = 1) {
      if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, removed: 0 };
      let remaining = quantity;
      for (let i = slots.length - 1; i >= 0 && remaining > 0; i--) {
        const slot = slots[i];
        if (slot.definitionId !== definitionId) continue;
        const amount = Math.min(remaining, slot.quantity);
        slot.quantity -= amount; remaining -= amount;
        if (slot.quantity === 0) slots.splice(i, 1);
      }
      return { ok: remaining === 0, removed: quantity - remaining, remaining };
    },
    has(definitionId, quantity = 1) { return this.count(definitionId) >= quantity; },
    clear() { slots.length = 0; },
    snapshot() { return { capacity, items: this.items }; }
  };
  return inventory;
}
