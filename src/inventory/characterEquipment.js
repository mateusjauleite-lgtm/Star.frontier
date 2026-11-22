// Inventário pessoal e equipamentos do explorador.
import { itemDatabase } from '../items/itemDatabase.js';
import { createItemInstance } from '../items/itemInstances.js';
import { createInventory } from '../items/inventory/inventoryCore.js';

const SLOTS = Object.freeze(['head', 'torso', 'hands', 'legs', 'feet', 'back', 'weapon']);
const BASE_CAPACITY = 12;
const DEFAULT_CAPACITY = 24;
const DEFAULT_MAX_WEIGHT = 60;
const SLOT_ALIASES = Object.freeze({ helmet: 'head', gloves: 'hands', boots: 'feet' });
const LEGACY_ITEM_IDS = Object.freeze({
  'equipment.helmet.explorer.basic': 'equipment.explorer-helmet',
  'equipment.backpack.small': 'equipment.compact-backpack'
});
const LEGACY_ITEM_NAMES = Object.freeze({
  'Capacete explorador': 'equipment.explorer-helmet',
  'Capacete básico': 'equipment.explorer-helmet',
  'Mochila compacta': 'equipment.compact-backpack',
  'Mochila de exploração': 'equipment.backpack.medium',
  'Mochila militar': 'equipment.backpack.military',
  'Phaser': 'weapon.phaser'
});
const VISUAL_SLOTS = SLOTS;

function resolveDefinitionId(raw) {
  const rawId = typeof raw === 'string'
    ? raw
    : raw?.definitionId || raw?.itemId || raw?.id || '';
  const mapped = LEGACY_ITEM_IDS[rawId] || rawId;
  if (itemDatabase.has(mapped)) return mapped;
  const name = typeof raw === 'string' ? raw : raw?.name;
  const byName = LEGACY_ITEM_NAMES[name];
  return byName && itemDatabase.has(byName) ? byName : 'legacy.unknown';
}

function normalizeLegacyInstances(raw) {
  if (!raw || (typeof raw !== 'object' && typeof raw !== 'string')) return [];
  const definitionId = resolveDefinitionId(raw);
  const definition = itemDatabase.get(definitionId);
  if (!definition) return [];
  const rawQuantity = typeof raw === 'object' ? Number(raw.quantity) : 1;
  const total = Number.isSafeInteger(rawQuantity) && rawQuantity > 0 ? rawQuantity : 1;
  const metadata = typeof raw === 'object' && raw.metadata && !Array.isArray(raw.metadata)
    ? { ...raw.metadata }
    : {};
  if (definitionId === 'legacy.unknown') {
    metadata.legacyName = typeof raw === 'string' ? raw : (raw.name || raw.itemId || raw.id || 'Item antigo');
    metadata.legacyItemId = typeof raw === 'string' ? raw : (raw.definitionId || raw.itemId || raw.id || '');
    metadata.legacyCategory = typeof raw === 'object' ? (raw.category || '') : '';
    metadata.legacySlot = typeof raw === 'object' ? (raw.slot || '') : '';
  }

  const chunks = [];
  let remaining = total;
  while (remaining > 0) {
    const quantity = definition.stackable ? Math.min(remaining, definition.maxStack) : 1;
    chunks.push(quantity);
    remaining -= quantity;
  }
  const instanceId = typeof raw === 'object' && typeof raw.instanceId === 'string' && raw.instanceId.trim()
    ? raw.instanceId
    : undefined;
  const durability = typeof raw === 'object' && typeof raw.durability === 'number' &&
    Number.isFinite(raw.durability) && raw.durability >= 0
    ? raw.durability
    : undefined;
  return chunks.map((quantity, index) => createItemInstance(definition, {
    instanceId: index === 0 ? instanceId : undefined,
    quantity,
    durability,
    metadata
  }));
}

function uniqueInstances(items, excludedIds = new Set()) {
  const seen = new Set(excludedIds);
  const result = [];
  for (const item of items) {
    if (!item || seen.has(item.instanceId)) continue;
    seen.add(item.instanceId);
    result.push(item);
  }
  return result;
}

export function createCharacterEquipmentSystem(gameState, {
  applyVisual = () => {},
  onChange = () => {},
  baseCapacity = BASE_CAPACITY,
  defaultCapacity = DEFAULT_CAPACITY,
  maxWeight = DEFAULT_MAX_WEIGHT
} = {}) {
  if (!gameState.inventory || typeof gameState.inventory !== 'object' || Array.isArray(gameState.inventory)) {
    gameState.inventory = { items: [], overflowItems: [], capacity: defaultCapacity, maxWeight, equipment: {} };
  }
  const savedInventory = gameState.inventory;
  savedInventory.items = Array.isArray(savedInventory.items) ? savedInventory.items : [];
  savedInventory.overflowItems = Array.isArray(savedInventory.overflowItems) ? savedInventory.overflowItems : [];
  if (!savedInventory.equipment || typeof savedInventory.equipment !== 'object' || Array.isArray(savedInventory.equipment)) {
    savedInventory.equipment = {};
  }
  if (!Number.isSafeInteger(savedInventory.capacity) || savedInventory.capacity < 1) savedInventory.capacity = defaultCapacity;
  if (typeof savedInventory.maxWeight !== 'number' || !Number.isFinite(savedInventory.maxWeight) || savedInventory.maxWeight < 0) {
    savedInventory.maxWeight = maxWeight;
  }

  let inventory = null;
  let initialized = false;
  let equipment = Object.fromEntries(SLOTS.map(slot => [slot, null]));

  function makeItem(itemId, options = {}) {
    const definitionId = LEGACY_ITEM_IDS[itemId] || itemId;
    const definition = itemDatabase.get(definitionId);
    if (!definition) throw new TypeError('Item desconhecido: ' + itemId);
    return createItemInstance(definition, options);
  }

  function publicItem(item) {
    if (!item) return null;
    const definition = itemDatabase.get(item.definitionId);
    return {
      ...item,
      itemId: item.definitionId,
      name: item.metadata?.legacyName || definition?.name || item.definitionId,
      code: definition?.code || 'LEGACY',
      category: definition?.category || item.metadata?.legacyCategory || 'resource',
      slot: definition?.attributes?.slot || item.metadata?.legacySlot || null
    };
  }

  function backpackCapacity(item) {
    const definition = item ? itemDatabase.get(item.definitionId) : null;
    const capacity = definition?.attributes?.capacity;
    return Number.isSafeInteger(capacity) && capacity > 0 ? capacity : baseCapacity;
  }

  function snapshot() {
    const items = inventory?.items || [];
    const overflowItems = inventory?.overflowItems || [];
    return {
      items: items.map(publicItem),
      overflowItems: overflowItems.map(publicItem),
      capacity: inventory?.capacity ?? savedInventory.capacity ?? defaultCapacity,
      maxWeight: inventory?.maxWeight ?? savedInventory.maxWeight ?? maxWeight,
      usedWeight: inventory?.usedWeight ?? 0,
      equipment: Object.fromEntries(SLOTS.map(slot => [slot, publicItem(equipment[slot])]))
    };
  }

  function persist() {
    if (!inventory) return;
    const previousEquipment = savedInventory.equipment && typeof savedInventory.equipment === 'object'
      ? savedInventory.equipment
      : {};
    const nextEquipment = { ...previousEquipment };
    for (const slot of SLOTS) nextEquipment[slot] = publicItem(equipment[slot]);
    // Aliases antigos são zerados depois de migrados; tool/machine continuam intactos.
    for (const alias of ['suit', 'helmet', 'gloves', 'boots']) nextEquipment[alias] = null;
    savedInventory.items = inventory.items.map(publicItem);
    savedInventory.overflowItems = inventory.overflowItems.map(publicItem);
    savedInventory.capacity = inventory.capacity;
    savedInventory.maxWeight = inventory.maxWeight === Infinity ? null : inventory.maxWeight;
    savedInventory.equipment = nextEquipment;
    gameState.inventory = savedInventory;
  }

  function syncVisuals() {
    for (const slot of VISUAL_SLOTS) {
      const item = equipment[slot];
      const definition = item ? itemDatabase.get(item.definitionId) : null;
      applyVisual(slot, definition?.attributes?.visualId || item?.definitionId || null, publicItem(item));
    }
  }

  function publish() {
    persist();
    onChange(snapshot());
  }

  function storeReturnedInstance(item) {
    const inserted = inventory.addInstance(item);
    if (inserted.ok) return inserted;
    return inventory.addOverflowInstance(item);
  }

  function initialize() {
    if (initialized) return snapshot();

    const rawItems = savedInventory.items.flatMap(normalizeLegacyInstances);
    const rawOverflow = savedInventory.overflowItems.flatMap(normalizeLegacyInstances);
    const normalizedEquipment = Object.fromEntries(SLOTS.map(slot => [slot, null]));
    const equipmentOverflow = [];
    const rawEquipment = { ...savedInventory.equipment };
    const legacySuit = rawEquipment.suit;
    const isDefaultLegacySuit = typeof legacySuit === 'string' &&
      legacySuit.toLowerCase().includes('traje de exploração');

    if (isDefaultLegacySuit) rawEquipment.suit = null;

    const aliases = { ...SLOT_ALIASES };
    for (const [legacySlot, raw] of Object.entries(rawEquipment)) {
      if (raw == null || legacySlot === 'tool' || legacySlot === 'machine') continue;
      const slot = aliases[legacySlot] || legacySlot;
      const instances = normalizeLegacyInstances(raw);
      if (!instances.length) continue;
      const candidate = instances[0];
      const definition = itemDatabase.get(candidate.definitionId);
      if (!SLOTS.includes(slot) || definition?.attributes?.slot !== slot || normalizedEquipment[slot]) {
        equipmentOverflow.push(...instances);
        continue;
      }
      normalizedEquipment[slot] = candidate;
      if (instances.length > 1) equipmentOverflow.push(...instances.slice(1));
    }

    const equippedIds = new Set(Object.values(normalizedEquipment).filter(Boolean).map(item => item.instanceId));
    for (const slot of ['tool', 'machine']) {
      const instanceId = savedInventory.equipment[slot]?.instanceId;
      if (instanceId) equippedIds.add(instanceId);
    }
    const items = uniqueInstances(rawItems, equippedIds);
    const overflowItems = uniqueInstances(
      [...rawOverflow, ...equipmentOverflow],
      new Set([...equippedIds, ...items.map(item => item.instanceId)])
    );

    // O traje legado era um rótulo único; recupera peças já existentes antes de criar novas.
    if (isDefaultLegacySuit) {
      const suitPieces = [
        ['torso', 'clothing.field-jacket'],
        ['legs', 'clothing.utility-trousers'],
        ['feet', 'clothing.exploration-boots']
      ];
      for (const [slot, itemId] of suitPieces) {
        if (normalizedEquipment[slot]) continue;
        const itemIndex = items.findIndex(item => item.definitionId === itemId);
        if (itemIndex >= 0) {
          normalizedEquipment[slot] = items.splice(itemIndex, 1)[0];
          continue;
        }
        const overflowIndex = overflowItems.findIndex(item => item.definitionId === itemId);
        if (overflowIndex >= 0) {
          normalizedEquipment[slot] = overflowItems.splice(overflowIndex, 1)[0];
          continue;
        }
        normalizedEquipment[slot] = makeItem(itemId);
      }
    }

    // Se a mochila estava guardada, equipa a mesma instância para ativar sua capacidade.
    if (!normalizedEquipment.back) {
      const isBackpack = item => itemDatabase.get(item.definitionId)?.attributes?.slot === 'back';
      const itemIndex = items.findIndex(isBackpack);
      if (itemIndex >= 0) {
        normalizedEquipment.back = items.splice(itemIndex, 1)[0];
      } else {
        const overflowIndex = overflowItems.findIndex(isBackpack);
        if (overflowIndex >= 0) normalizedEquipment.back = overflowItems.splice(overflowIndex, 1)[0];
      }
    }

    const savedCapacity = Number.isSafeInteger(savedInventory.capacity) && savedInventory.capacity > 0
      ? savedInventory.capacity
      : defaultCapacity;
    if (!normalizedEquipment.back) {
      const bagId = savedCapacity === 12
        ? 'equipment.compact-backpack'
        : savedCapacity === 40
          ? 'equipment.backpack.military'
          : 'equipment.backpack.medium';
      normalizedEquipment.back = makeItem(bagId);
    }

    equipment = normalizedEquipment;
    const capacity = backpackCapacity(equipment.back);
    const savedMaxWeight = typeof savedInventory.maxWeight === 'number' &&
      Number.isFinite(savedInventory.maxWeight) && savedInventory.maxWeight >= 0
      ? savedInventory.maxWeight
      : maxWeight;
    inventory = createInventory({
      registry: itemDatabase,
      capacity,
      maxWeight: savedMaxWeight,
      items,
      overflowItems
    });

    // Kit básico compatível com o modelo humanoide atual.
    for (const itemId of ['equipment.explorer-helmet', 'equipment.utility-gloves', 'weapon.phaser']) {
      const slot = itemDatabase.get(itemId)?.attributes?.slot;
      const exists = inventory.items.some(item => item.definitionId === itemId) ||
        inventory.overflowItems.some(item => item.definitionId === itemId) ||
        (slot && equipment[slot]);
      if (!exists) inventory.addWithOverflow(itemId, 1);
    }

    if (gameState.dilithiumInventoryVersion !== 1) {
      if (inventory.count('ore.dilithium.raw') === 0) {
        const legacyRaw = Math.floor(Math.max(0, Number(gameState.rawDilithiumOre) || 0));
        const stored = inventory.addWithOverflow('ore.dilithium.raw', legacyRaw > 0 ? legacyRaw : 12);
        if (legacyRaw > 0) gameState.rawDilithiumOre = Math.max(0, legacyRaw - stored.added);
      }
      gameState.dilithiumInventoryVersion = 1;
    }
    initialized = true;
    syncVisuals();
    publish();
    return snapshot();
  }

  function equip(instanceId) {
    if (!inventory) return { ok: false, reason: 'Inventário não inicializado.' };
    const candidate = [...inventory.items, ...inventory.overflowItems]
      .find(item => item.instanceId === instanceId);
    if (!candidate) return { ok: false, reason: 'Item não encontrado na mochila.' };
    if (candidate.quantity !== 1) return { ok: false, reason: 'Separe a pilha antes de equipar.' };
    const definition = itemDatabase.get(candidate.definitionId);
    const slot = definition?.attributes?.slot;
    if (!SLOTS.includes(slot)) return { ok: false, reason: 'Este item não pode ser equipado neste estágio.' };

    const removed = inventory.removeInstance(instanceId);
    if (!removed) return { ok: false, reason: 'Item não encontrado na mochila.' };
    const previous = equipment[slot] || null;
    if (previous) {
      const returned = storeReturnedInstance(previous);
      if (!returned.ok) {
        inventory.addOverflowInstance(removed);
        return { ok: false, reason: 'Não foi possível devolver o equipamento anterior.' };
      }
    }
    equipment[slot] = removed;
    if (slot === 'back') inventory.setCapacity(backpackCapacity(removed));
    syncVisuals();
    publish();
    return { ok: true, item: publicItem(removed), replaced: publicItem(previous) };
  }

  function unequip(slot) {
    if (!SLOTS.includes(slot)) return { ok: false, reason: 'Espaço inválido.' };
    const item = equipment[slot];
    if (!item) return { ok: false, reason: 'Este espaço já está vazio.' };
    const returned = storeReturnedInstance(item);
    if (!returned.ok) return { ok: false, reason: returned.reason };
    equipment[slot] = null;
    if (slot === 'back') inventory.setCapacity(baseCapacity);
    syncVisuals();
    publish();
    return { ok: true, item: publicItem(item), storedInOverflow: Boolean(returned.storedInOverflow) };
  }

  function toggleSlot(slot) {
    if (!SLOTS.includes(slot)) return { ok: false, reason: 'Espaço inválido.' };
    if (equipment[slot]) return unequip(slot);
    const candidate = [...inventory.items, ...inventory.overflowItems].find(item =>
      itemDatabase.get(item.definitionId)?.attributes?.slot === slot
    );
    return candidate ? equip(candidate.instanceId) : { ok: false, reason: 'Nenhum item compatível na mochila.' };
  }

  function add(itemId, quantity = 1, options = {}) {
    if (!inventory) return { ok: false, reason: 'Inventário não inicializado.', added: 0, remaining: quantity };
    const definitionId = LEGACY_ITEM_IDS[itemId] || itemId;
    const result = inventory.addWithOverflow(definitionId, quantity, options);
    if (result.added > 0) publish();
    return result;
  }

  function moveOverflowToInventory(instanceId) {
    if (!inventory) return { ok: false, reason: 'Inventário não inicializado.' };
    const result = inventory.moveOverflowToInventory(instanceId);
    if (result.ok) publish();
    return result;
  }
  function removeInstance(instanceId) {
    if (!inventory) return { ok: false, reason: 'Inventário não inicializado.' };
    const removed = inventory.removeInstance(instanceId);
    if (!removed) return { ok: false, reason: 'Item não encontrado no inventário.' };
    publish(); return { ok: true, item: publicItem(removed) };
  }
  function restoreInstance(item) {
    if (!inventory || !item) return { ok: false, reason: 'Item inválido para restauração.' };
    const restored = inventory.addInstance(item); if (restored.ok) publish(); return restored;
  }

  return Object.freeze({
    initialize,
    snapshot,
    equip,
    unequip,
    toggleSlot,
    add,
    moveOverflowToInventory,
    removeInstance,
    restoreInstance,
    equippedItem: slot => publicItem(equipment[slot] || null),
    getOverflowItems: () => (inventory?.overflowItems || []).map(publicItem)
  });
}
