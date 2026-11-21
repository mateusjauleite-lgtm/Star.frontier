// Escudos defletores da nave: absorvem dano antes de atingir o casco e recarregam após um intervalo.
const MAX_DELTA_SECONDS = 0.1;
const RECHARGE_DELAY_SECONDS = 3;
const RECHARGE_PER_SECOND = 5;

export function createShipShieldSystem(state, options = {}) {
  if (!state || typeof state !== 'object') throw new TypeError('O estado compartilhado da nave é obrigatório.');
  const capacity = Number.isFinite(options.capacity) ? Math.max(1, options.capacity) : 100;
  const rechargePerSecond = Number.isFinite(options.rechargePerSecond)
    ? Math.max(0, options.rechargePerSecond) : RECHARGE_PER_SECOND;
  const rechargeDelay = Number.isFinite(options.rechargeDelay)
    ? Math.max(0, options.rechargeDelay) : RECHARGE_DELAY_SECONDS;
  state.shield = clamp(state.shield ?? capacity, 0, capacity);
  state.hull = clamp(state.hull ?? 100, 0, 100);
  state.shieldEnabled = state.shieldEnabled !== false;
  let rechargeRemaining = 0;

  function applyDamage(amount) {
    const requested = Math.max(0, Number(amount) || 0);
    const absorbed = state.shieldEnabled ? Math.min(state.shield, requested) : 0;
    const hullDamage = requested - absorbed;
    state.shield = clamp(state.shield - absorbed, 0, capacity);
    state.hull = clamp(state.hull - hullDamage, 0, 100);
    if (absorbed > 0) rechargeRemaining = rechargeDelay;
    return Object.freeze({ requested, absorbed, hullDamage, shield: state.shield, hull: state.hull });
  }

  function update(deltaSeconds) {
    const dt = Math.max(0, Math.min(MAX_DELTA_SECONDS,
      Number.isFinite(deltaSeconds) ? deltaSeconds : 0));
    if (rechargeRemaining > 0) rechargeRemaining = Math.max(0, rechargeRemaining - dt);
    else if (state.shieldEnabled && state.hull > 0 && state.shield < capacity) {
      state.shield = clamp(state.shield + rechargePerSecond * dt, 0, capacity);
    }
    return snapshot();
  }

  function setEnabled(enabled) {
    state.shieldEnabled = Boolean(enabled);
    return snapshot();
  }

  function snapshot() {
    return Object.freeze({
      enabled: Boolean(state.shieldEnabled),
      shield: clamp(state.shield, 0, capacity),
      capacity,
      hull: clamp(state.hull, 0, 100),
      rechargeRemaining,
      integrity: clamp(state.shield, 0, capacity) / capacity
    });
  }

  return Object.freeze({ applyDamage, update, setEnabled, snapshot });
}

function clamp(value, min, max) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? number : min));
}
