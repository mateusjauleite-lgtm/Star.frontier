// Núcleo lógico do personagem — independente de Three.js e da interface.
// Cada personagem recebe seu próprio inventário, sem compartilhar itens com naves.
import { emit } from '../core/events.js';
import { createInventory } from '../items/inventory/inventoryCore.js';

const DEFAULT_CHARACTER_STATE = {
  initialized: false, mode: 'on-foot', posture: 'standing', health: 100,
  stamina: 100, grounded: true, movement: { x: 0, y: 0 }, look: { x: 0, y: 0 },
  interactionTarget: null,
  equipment: { suit: 'Traje de exploração básico', tool: null }
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const validNumber = value => Number.isFinite(value);
function copyState(state) {
  return { ...state, movement: { ...state.movement }, look: { ...state.look }, equipment: { ...state.equipment } };
}

/** inventorySnapshot restaura os pertences persistidos no perfil do jogador. */
export function createCharacterCore(initialState = {}, options = {}) {
  const state = {
    ...DEFAULT_CHARACTER_STATE, ...initialState,
    movement: { ...DEFAULT_CHARACTER_STATE.movement, ...(initialState.movement || {}) },
    look: { ...DEFAULT_CHARACTER_STATE.look, ...(initialState.look || {}) },
    equipment: { ...DEFAULT_CHARACTER_STATE.equipment, ...(initialState.equipment || {}) }
  };
  const saved = options.inventorySnapshot;
  const inventory = options.itemRegistry ? createInventory({
    registry: options.itemRegistry,
    capacity: saved?.capacity ?? options.inventoryCapacity ?? 24,
    maxWeight: saved?.maxWeight ?? options.inventoryMaxWeight ?? 60,
    items: Array.isArray(saved?.items) ? saved.items : []
  }) : null;

  function snapshot() { return { ...copyState(state), inventory: inventory?.snapshot() ?? null }; }
  function publish(eventName) {
    emit(eventName, snapshot());
    emit('character:updated', snapshot());
  }
  function initialize() {
    if (state.initialized) return snapshot();
    state.initialized = true; publish('character:initialized'); return snapshot();
  }
  function setMode(mode) {
    if (!['on-foot', 'ship-control'].includes(mode)) throw new TypeError('Modo do personagem inválido.');
    state.mode = mode; state.posture = mode === 'ship-control' ? 'seated' : 'standing';
    state.movement = { x: 0, y: 0 }; publish('character:mode-changed'); return snapshot();
  }
  function setMovement(x, y) {
    if (state.mode !== 'on-foot' || !validNumber(x) || !validNumber(y)) return snapshot();
    state.movement = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
    publish('character:movement-changed'); return snapshot();
  }
  function setLook(x, y) {
    if (state.mode !== 'on-foot' || !validNumber(x) || !validNumber(y)) return snapshot();
    state.look = { x, y }; publish('character:look-changed'); return snapshot();
  }
  function setGrounded(value) { state.grounded = Boolean(value); publish('character:grounded-changed'); return snapshot(); }
  function setHealth(value) {
    if (!validNumber(value)) return snapshot();
    state.health = clamp(value, 0, 100); publish('character:health-changed'); return snapshot();
  }
  function setStamina(value) {
    if (!validNumber(value)) return snapshot();
    state.stamina = clamp(value, 0, 100); publish('character:stamina-changed'); return snapshot();
  }
  function setInteractionTarget(target) { state.interactionTarget = target ?? null; publish('character:interaction-target-changed'); return snapshot(); }
  function setEquipment(slot, item) {
    if (!Object.hasOwn(state.equipment, slot)) throw new TypeError('Espaço de equipamento desconhecido.');
    state.equipment[slot] = item ?? null; publish('character:equipment-changed'); return snapshot();
  }
  function addItem(id, quantity = 1, itemOptions = {}) {
    if (!inventory) return { ok: false, reason: 'inventory-unavailable', added: 0, remaining: quantity };
    const result = inventory.add(id, quantity, itemOptions);
    if (result.added > 0) publish('character:inventory-changed');
    return result;
  }
  function removeItem(id, quantity = 1) {
    if (!inventory) return { ok: false, reason: 'inventory-unavailable', removed: 0, remaining: quantity };
    const result = inventory.remove(id, quantity);
    if (result.removed > 0) publish('character:inventory-changed');
    return result;
  }
  function hasItem(id, quantity = 1) { return inventory?.has(id, quantity) ?? false; }
  function reset() {
    Object.assign(state, copyState(DEFAULT_CHARACTER_STATE));
    // Reiniciar o estado do corpo não apaga o inventário do personagem.
    publish('character:reset'); return snapshot();
  }
  return Object.freeze({
    initialize, snapshot, setMode,
    enterShipSeat: () => setMode('ship-control'), leaveShipSeat: () => setMode('on-foot'),
    setMovement, setLook, setGrounded, setHealth, setStamina, setInteractionTarget,
    setEquipment, addItem, removeItem, hasItem,
    getInventorySnapshot: () => inventory?.snapshot() ?? null, reset
  });
}
