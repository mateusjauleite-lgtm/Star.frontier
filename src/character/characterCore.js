// Núcleo do personagem — Star Frontier
// Camada lógica independente de Three.js e da interface.
// Responsável por estado, postura, controle e eventos do personagem.

import { emit } from '../core/events.js';

const DEFAULT_CHARACTER_STATE = {
  initialized: false,
  mode: 'on-foot', // 'on-foot' | 'ship-control'
  posture: 'standing', // 'standing' | 'seated'
  health: 100,
  stamina: 100,
  grounded: true,
  movement: { x: 0, y: 0 },
  look: { x: 0, y: 0 },
  interactionTarget: null,
  equipment: {
    suit: 'Traje de exploração básico',
    tool: null
  }
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const validNumber = value => Number.isFinite(value);

function copyState(state) {
  return {
    ...state,
    movement: { ...state.movement },
    look: { ...state.look },
    equipment: { ...state.equipment }
  };
}

/**
 * Cria o núcleo lógico do personagem.
 * O módulo não cria modelos 3D nem elementos de HUD; esses sistemas
 * poderão observar os eventos e consumir os snapshots deste núcleo.
 */
export function createCharacterCore(initialState = {}) {
  const state = {
    ...DEFAULT_CHARACTER_STATE,
    ...initialState,
    movement: {
      ...DEFAULT_CHARACTER_STATE.movement,
      ...(initialState.movement || {})
    },
    look: {
      ...DEFAULT_CHARACTER_STATE.look,
      ...(initialState.look || {})
    },
    equipment: {
      ...DEFAULT_CHARACTER_STATE.equipment,
      ...(initialState.equipment || {})
    }
  };

  function snapshot() {
    return copyState(state);
  }

  function publish(eventName) {
    emit(eventName, snapshot());
    emit('character:updated', snapshot());
  }

  function initialize() {
    if (state.initialized) return snapshot();
    state.initialized = true;
    publish('character:initialized');
    return snapshot();
  }

  function setMode(mode) {
    if (!['on-foot', 'ship-control'].includes(mode)) {
      throw new TypeError('Modo do personagem inválido.');
    }

    if (mode === 'on-foot') {
      state.mode = 'on-foot';
      state.posture = 'standing';
      state.movement = { x: 0, y: 0 };
    } else {
      state.mode = 'ship-control';
      state.posture = 'seated';
      state.movement = { x: 0, y: 0 };
    }

    publish('character:mode-changed');
    return snapshot();
  }

  function enterShipSeat() {
    return setMode('ship-control');
  }

  function leaveShipSeat() {
    return setMode('on-foot');
  }

  function setMovement(x, y) {
    if (state.mode !== 'on-foot') return snapshot();
    if (!validNumber(x) || !validNumber(y)) return snapshot();

    state.movement = {
      x: clamp(x, -1, 1),
      y: clamp(y, -1, 1)
    };
    publish('character:movement-changed');
    return snapshot();
  }

  function setLook(x, y) {
    if (state.mode !== 'on-foot') return snapshot();
    if (!validNumber(x) || !validNumber(y)) return snapshot();

    state.look = { x, y };
    publish('character:look-changed');
    return snapshot();
  }

  function setGrounded(grounded) {
    state.grounded = Boolean(grounded);
    publish('character:grounded-changed');
    return snapshot();
  }

  function setHealth(value) {
    if (!validNumber(value)) return snapshot();
    state.health = clamp(value, 0, 100);
    publish('character:health-changed');
    return snapshot();
  }

  function setStamina(value) {
    if (!validNumber(value)) return snapshot();
    state.stamina = clamp(value, 0, 100);
    publish('character:stamina-changed');
    return snapshot();
  }

  function setInteractionTarget(target) {
    state.interactionTarget = target ?? null;
    publish('character:interaction-target-changed');
    return snapshot();
  }

  function setEquipment(slot, item) {
    if (!Object.hasOwn(state.equipment, slot)) {
      throw new TypeError('Espaço de equipamento desconhecido.');
    }
    state.equipment[slot] = item ?? null;
    publish('character:equipment-changed');
    return snapshot();
  }

  function reset() {
    Object.assign(state, copyState(DEFAULT_CHARACTER_STATE));
    publish('character:reset');
    return snapshot();
  }

  return Object.freeze({
    initialize,
    snapshot,
    setMode,
    enterShipSeat,
    leaveShipSeat,
    setMovement,
    setLook,
    setGrounded,
    setHealth,
    setStamina,
    setInteractionTarget,
    setEquipment,
    reset
  });
}
