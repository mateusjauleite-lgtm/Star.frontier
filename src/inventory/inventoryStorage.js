const STORAGE_KEY = 'sf-inventory-v1';
export function saveInventory(inventory, storage = globalThis.localStorage) {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(inventory.snapshot())); return true; }
  catch (error) { console.warn('Falha ao salvar inventário:', error); return false; }
}
export function loadInventory(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.items)) return null;
    return { capacity: Number.isInteger(data.capacity) ? data.capacity : 24, items: data.items };
  } catch (error) { console.warn('Falha ao carregar inventário:', error); return null; }
}
export { STORAGE_KEY as INVENTORY_STORAGE_KEY };
