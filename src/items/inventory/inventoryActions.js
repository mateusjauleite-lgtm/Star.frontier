export function createInventoryActions(inventory, registry) {
  if (!inventory || !registry) throw new TypeError('Inventário e registry são obrigatórios.');
  return Object.freeze({
    add: (id, quantity = 1, options) => inventory.addWithOverflow?.(id, quantity, options) ?? inventory.add(id, quantity, options),
    remove: (id, quantity = 1) => inventory.remove(id, quantity),
    inspect: id => registry.get(id),
    count: id => inventory.count(id),
    canUse: id => Boolean(registry.get(id)?.category === 'consumable' && inventory.has(id))
  });
}
