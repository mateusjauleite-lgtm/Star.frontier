// Catálogo e ciclo de vida dos equipamentos do personagem.
export const CHARACTER_ITEMS = Object.freeze({
  'clothing.field-jacket': { name: 'Jaqueta de campo', slot: 'torso' },
  'clothing.utility-trousers': { name: 'Calça utilitária', slot: 'legs' },
  'clothing.exploration-boots': { name: 'Botas de exploração', slot: 'feet' },
  'equipment.explorer-helmet': { name: 'Capacete explorador', slot: 'head' },
  'equipment.utility-gloves': { name: 'Luvas utilitárias', slot: 'hands' },
  'equipment.compact-backpack': { name: 'Mochila compacta', slot: 'back' }
});
const SLOTS = ['head', 'torso', 'hands', 'legs', 'feet', 'back'];
const id = () => globalThis.crypto?.randomUUID?.() || `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;

export function createCharacterEquipmentSystem(gameState, { applyVisual = () => {}, onChange = () => {} } = {}) {
  gameState.inventory ||= { items: [], equipment: {} };
  const inventory = gameState.inventory;
  inventory.items = Array.isArray(inventory.items) ? inventory.items : [];
  inventory.equipment ||= {};
  const equipment = inventory.equipment;

  const find = instanceId => inventory.items.find(item => item.instanceId === instanceId) || null;
  const create = itemId => {
    const definition = CHARACTER_ITEMS[itemId];
    if (!definition) throw new TypeError('Item desconhecido: ' + itemId);
    const item = { instanceId: id(), itemId, name: definition.name, category: itemId.startsWith('clothing.') ? 'clothing' : 'equipment', slot: definition.slot, quantity: 1 };
    inventory.items.push(item);
    return item;
  };
  const equippedItem = slot => {
    const item = find(equipment[slot]);
    return item ? { ...item } : null;
  };
  const publish = () => onChange(snapshot());
  function snapshot() {
    return { items: inventory.items.map(item => ({ ...item })), equipment: Object.fromEntries(SLOTS.map(slot => [slot, equippedItem(slot)])) };
  }
  function syncVisuals() {
    for (const slot of SLOTS) {
      const item = equippedItem(slot);
      applyVisual(slot, item?.itemId || null, item);
    }
  }
  function initialize() {
    inventory.items = inventory.items.filter(item => item && typeof item === 'object');
    for (const item of inventory.items) {
      item.instanceId ||= id();
      if (!item.itemId && CHARACTER_ITEMS[item.id]) item.itemId = item.id;
      const definition = CHARACTER_ITEMS[item.itemId];
      if (definition) Object.assign(item, { name: definition.name, slot: definition.slot, quantity: Math.max(1, Number(item.quantity) || 1) });
    }
    // Migração segura do traje antigo para três peças independentes.
    if (equipment.suit) {
      for (const itemId of ['clothing.field-jacket', 'clothing.utility-trousers', 'clothing.exploration-boots']) {
        const slot = CHARACTER_ITEMS[itemId].slot;
        if (!equippedItem(slot)) equipment[slot] = create(itemId).instanceId;
      }
      equipment.suit = null;
    }
    // Migra IDs antigos armazenados diretamente nos slots.
    const legacy = { helmet: 'head', gloves: 'hands' };
    for (const [oldSlot, slot] of Object.entries(legacy)) {
      const old = equipment[oldSlot];
      if (old && CHARACTER_ITEMS[old]) equipment[slot] = create(old).instanceId;
      equipment[oldSlot] = null;
    }
    for (const slot of SLOTS) {
      const current = equipment[slot];
      if (current && !find(current)) {
        if (CHARACTER_ITEMS[current]) equipment[slot] = create(current).instanceId;
        else equipment[slot] = null;
      }
    }
    // Kit demonstrativo para os três espaços adicionais, sem duplicar posse.
    for (const itemId of ['equipment.explorer-helmet', 'equipment.utility-gloves', 'equipment.compact-backpack']) {
      if (!inventory.items.some(item => item.itemId === itemId)) create(itemId);
    }
    syncVisuals();
    publish();
    return snapshot();
  }
  function equip(instanceId) {
    const item = find(instanceId);
    if (!item) return { ok: false, reason: 'Item não encontrado na mochila.' };
    const definition = CHARACTER_ITEMS[item.itemId];
    if (!definition || !SLOTS.includes(definition.slot)) return { ok: false, reason: 'Este item não pode ser equipado.' };
    const previous = equipment[definition.slot];
    if (previous === instanceId) return { ok: true, changed: false, item: { ...item } };
    equipment[definition.slot] = instanceId;
    syncVisuals();
    publish();
    return { ok: true, changed: true, item: { ...item }, replaced: find(previous) ? { ...find(previous) } : null };
  }
  function unequip(slot) {
    if (!SLOTS.includes(slot)) return { ok: false, reason: 'Espaço inválido.' };
    const item = equippedItem(slot);
    if (!item) return { ok: false, reason: 'Este espaço já está vazio.' };
    equipment[slot] = null;
    syncVisuals();
    publish();
    return { ok: true, item };
  }
  function toggleSlot(slot) {
    if (!SLOTS.includes(slot)) return { ok: false, reason: 'Espaço inválido.' };
    if (equipment[slot]) return unequip(slot);
    const item = inventory.items.find(entry => CHARACTER_ITEMS[entry.itemId]?.slot === slot);
    return item ? equip(item.instanceId) : { ok: false, reason: 'Nenhum item compatível na mochila.' };
  }
  function add(itemId, quantity = 1) {
    if (!CHARACTER_ITEMS[itemId]) return { ok: false, reason: 'Item desconhecido.' };
    const added = Array.from({ length: Math.max(1, Math.floor(quantity)) }, () => create(itemId));
    publish();
    return { ok: true, items: added.map(item => ({ ...item })) };
  }
  return Object.freeze({ initialize, snapshot, equip, unequip, toggleSlot, add, equippedItem });
}
