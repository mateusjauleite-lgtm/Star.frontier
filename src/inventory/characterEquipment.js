// Catálogo e ciclo de vida dos equipamentos do personagem.
// Regra: itens equipados saem da mochila; ao desequipar/substituir, voltam à mochila.
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

  const makeItem = itemId => {
    const definition = CHARACTER_ITEMS[itemId];
    if (!definition) throw new TypeError('Item desconhecido: ' + itemId);
    return { instanceId: id(), itemId, name: definition.name, category: itemId.startsWith('clothing.') ? 'clothing' : 'equipment', slot: definition.slot, quantity: 1 };
  };
  const normalizeItem = item => {
    if (!item || typeof item !== 'object') return null;
    item.instanceId ||= id();
    if (!item.itemId && CHARACTER_ITEMS[item.id]) item.itemId = item.id;
    const definition = CHARACTER_ITEMS[item.itemId];
    if (!definition) return item;
    Object.assign(item, { name: definition.name, slot: definition.slot, quantity: Math.max(1, Number(item.quantity) || 1) });
    return item;
  };
  const equippedItem = slot => {
    const item = equipment[slot];
    return item && typeof item === 'object' ? { ...item } : null;
  };
  function snapshot() {
    return { items: inventory.items.map(item => ({ ...item })), equipment: Object.fromEntries(SLOTS.map(slot => [slot, equippedItem(slot)])) };
  }
  const publish = () => onChange(snapshot());
  function syncVisuals() {
    for (const slot of SLOTS) {
      const item = equippedItem(slot);
      applyVisual(slot, item?.itemId || null, item);
    }
  }
  function initialize() {
    inventory.items = inventory.items.map(normalizeItem).filter(Boolean);
    // Migra o traje legado para três instâncias independentes equipadas.
    if (equipment.suit) {
      for (const itemId of ['clothing.field-jacket', 'clothing.utility-trousers', 'clothing.exploration-boots']) {
        const slot = CHARACTER_ITEMS[itemId].slot;
        if (!equippedItem(slot)) equipment[slot] = makeItem(itemId);
      }
      equipment.suit = null;
    }
    // Migra os antigos slots que guardavam apenas o ID do item.
    const legacy = { helmet: 'head', gloves: 'hands' };
    for (const [oldSlot, slot] of Object.entries(legacy)) {
      const old = equipment[oldSlot];
      if (old && CHARACTER_ITEMS[old]) equipment[slot] = makeItem(old);
      equipment[oldSlot] = null;
    }
    for (const slot of SLOTS) {
      const current = equipment[slot];
      if (typeof current === 'string' && CHARACTER_ITEMS[current]) equipment[slot] = makeItem(current);
      else if (current && typeof current === 'object') equipment[slot] = normalizeItem(current);
      else if (!current) equipment[slot] = null;
    }
    // Migra qualquer peça que tenha sido salva na mochila pelo formato antigo.
    inventory.items = inventory.items.filter(item => !Object.values(equipment).some(worn => worn?.instanceId === item.instanceId));
    // Kit inicial dos espaços adicionais para permitir testar troca e devolução.
    for (const itemId of ['equipment.explorer-helmet', 'equipment.utility-gloves', 'equipment.compact-backpack']) {
      const slot = CHARACTER_ITEMS[itemId].slot;
      if (!equippedItem(slot) && !inventory.items.some(item => item.itemId === itemId)) inventory.items.push(makeItem(itemId));
    }
    syncVisuals();
    publish();
    return snapshot();
  }
  function equip(instanceId) {
    const index = inventory.items.findIndex(item => item.instanceId === instanceId);
    if (index < 0) return { ok: false, reason: 'Item não encontrado na mochila.' };
    const item = inventory.items[index];
    const definition = CHARACTER_ITEMS[item.itemId];
    if (!definition || !SLOTS.includes(definition.slot)) return { ok: false, reason: 'Este item não pode ser equipado.' };
    inventory.items.splice(index, 1);
    const previous = equipment[definition.slot];
    if (previous) inventory.items.push(previous);
    equipment[definition.slot] = item;
    syncVisuals();
    publish();
    return { ok: true, item: { ...item }, replaced: previous ? { ...previous } : null };
  }
  function unequip(slot) {
    if (!SLOTS.includes(slot)) return { ok: false, reason: 'Espaço inválido.' };
    const item = equipment[slot];
    if (!item) return { ok: false, reason: 'Este espaço já está vazio.' };
    inventory.items.push(item);
    equipment[slot] = null;
    syncVisuals();
    publish();
    return { ok: true, item: { ...item } };
  }
  function toggleSlot(slot) {
    if (!SLOTS.includes(slot)) return { ok: false, reason: 'Espaço inválido.' };
    if (equipment[slot]) return unequip(slot);
    const item = inventory.items.find(entry => CHARACTER_ITEMS[entry.itemId]?.slot === slot);
    return item ? equip(item.instanceId) : { ok: false, reason: 'Nenhum item compatível na mochila.' };
  }
  function add(itemId, quantity = 1) {
    if (!CHARACTER_ITEMS[itemId]) return { ok: false, reason: 'Item desconhecido.' };
    const added = Array.from({ length: Math.max(1, Math.floor(quantity)) }, () => makeItem(itemId));
    inventory.items.push(...added);
    publish();
    return { ok: true, items: added.map(item => ({ ...item })) };
  }
  return Object.freeze({ initialize, snapshot, equip, unequip, toggleSlot, add, equippedItem });
}
