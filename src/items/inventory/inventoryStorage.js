const STORAGE_KEY = 'sf-inventory-v1';

export function saveInventory(inventory, storage = globalThis.localStorage) {
  if (!inventory || typeof inventory.snapshot !== 'function') return false;
  try {
    if (!storage || typeof storage.setItem !== 'function') return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(inventory.snapshot()));
    return true;
  } catch (error) {
    console.warn('Falha ao salvar inventário:', error);
    return false;
  }
}

export function loadInventory(storage = globalThis.localStorage) {
  try {
    if (!storage || typeof storage.getItem !== 'function') return null;
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.items)) return null;
    return {
      capacity: Number.isSafeInteger(data.capacity) && data.capacity > 0 ? data.capacity : 24,
      maxWeight: typeof data.maxWeight === 'number' && Number.isFinite(data.maxWeight) && data.maxWeight >= 0 ? data.maxWeight : Infinity,
      items: data.items
    };
  } catch (error) {
    console.warn('Falha ao carregar inventário:', error);
    return null;
  }
}

export { STORAGE_KEY as INVENTORY_STORAGE_KEY };
