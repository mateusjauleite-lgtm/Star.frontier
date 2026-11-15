const DEFAULT_SLOTS = Object.freeze(['suit', 'helmet', 'torso', 'gloves', 'legs', 'boots', 'weapon', 'tool', 'machine']);
export function createEquipmentCore({ registry, slots = DEFAULT_SLOTS, initial = {} } = {}) {
  if (!registry) throw new TypeError('Item registry obrigatório.');
  const equipped = Object.fromEntries(slots.map(slot => [slot, initial[slot] ?? null]));
  function equip(instance) {
    const definition = registry.get(instance?.definitionId);
    if (!definition || definition.category !== 'equipment') return { ok: false, reason: 'invalid-equipment' };
    const slot = definition.attributes?.slot;
    if (!slots.includes(slot)) return { ok: false, reason: 'invalid-slot' };
    equipped[slot] = instance.instanceId;
    return { ok: true, slot, instanceId: instance.instanceId };
  }
  return Object.freeze({
    equip,
    unequip: slot => slots.includes(slot) ? (equipped[slot] = null, true) : false,
    get: slot => equipped[slot] ?? null,
    snapshot: () => ({ ...equipped })
  });
}
