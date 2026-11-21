// Núcleo energético independente do defletor de navegação.
// Recebe energia da reserva principal da nave e distribui sua reserva local
// para ramificações registradas, sem se misturar aos escudos gerais.
const MAX_DELTA_SECONDS = 0.1;
const DEFAULT_CAPACITY = 100;
const DEFAULT_CHARGE_RATE = 2;

export function createDeflectorCoreSystem(state, options = {}) {
  if (!state || typeof state !== 'object') throw new TypeError('O estado da nave é obrigatório.');

  const capacity = positive(options.capacity, DEFAULT_CAPACITY);
  const chargeRate = positive(options.chargeRate, DEFAULT_CHARGE_RATE);
  const primaryReserveKey = options.primaryReserveKey || 'refinedDilithium';

  state.deflectorCoreEnergy = clamp(state.deflectorCoreEnergy, 0, capacity);
  state.deflectorCoreEnabled = state.deflectorCoreEnabled !== false;
  state.deflectorCoreChargingEnabled = state.deflectorCoreChargingEnabled !== false;

  const branches = new Map();

  function registerBranch(id, config = {}) {
    const key = String(id || '').trim();
    if (!key) throw new TypeError('A ramificação precisa de um identificador.');
    if (branches.has(key)) throw new Error('Ramificação já registrada: ' + key);
    branches.set(key, {
      id: key,
      name: String(config.name || key),
      maxDrawPerSecond: positive(config.maxDrawPerSecond, Number.MAX_SAFE_INTEGER),
      enabled: config.enabled !== false,
      consumedTotal: 0,
      lastConsumptionRate: 0
    });
    return branchSnapshot(branches.get(key));
  }

  function setBranchEnabled(id, enabled) {
    const branch = getBranch(id);
    branch.enabled = Boolean(enabled);
    if (!branch.enabled) branch.lastConsumptionRate = 0;
    return branchSnapshot(branch);
  }

  function consumeEnergy(id, requestedAmount) {
    const branch = getBranch(id);
    const requested = Math.max(0, finite(requestedAmount));
    if (!state.deflectorCoreEnabled || !branch.enabled || requested === 0) {
      return Object.freeze({ accepted: requested === 0, consumed: 0, requested, remaining: energy() });
    }
    const allowed = Math.min(requested, branch.maxDrawPerSecond * MAX_DELTA_SECONDS);
    const consumed = Math.min(energy(), allowed);
    state.deflectorCoreEnergy = energy() - consumed;
    branch.consumedTotal += consumed;
    branch.lastConsumptionRate = consumed / MAX_DELTA_SECONDS;
    return Object.freeze({
      accepted: consumed >= requested - 1e-9,
      consumed,
      requested,
      remaining: energy()
    });
  }

  function update(deltaSeconds) {
    const dt = clamp(deltaSeconds, 0, MAX_DELTA_SECONDS);
    for (const branch of branches.values()) branch.lastConsumptionRate = 0;
    let transferred = 0;
    if (state.deflectorCoreEnabled && state.deflectorCoreChargingEnabled && dt > 0) {
      const source = Math.max(0, finite(state[primaryReserveKey]));
      const room = Math.max(0, capacity - energy());
      transferred = Math.min(source, room, chargeRate * dt);
      if (transferred > 0) {
        state[primaryReserveKey] = source - transferred;
        state.deflectorCoreEnergy = energy() + transferred;
      }
    }
    return snapshot(transferred);
  }

  function setEnabled(enabled) {
    state.deflectorCoreEnabled = Boolean(enabled);
    return snapshot();
  }

  function setChargingEnabled(enabled) {
    state.deflectorCoreChargingEnabled = Boolean(enabled);
    return snapshot();
  }

  function snapshot(lastTransfer = 0) {
    const current = energy();
    return Object.freeze({
      enabled: Boolean(state.deflectorCoreEnabled),
      chargingEnabled: Boolean(state.deflectorCoreChargingEnabled),
      energy: current,
      capacity,
      fill: capacity > 0 ? current / capacity : 0,
      transferRate: lastTransfer / MAX_DELTA_SECONDS,
      branches: Array.from(branches.values(), branchSnapshot)
    });
  }

  function branchSnapshot(branch) {
    return Object.freeze({
      id: branch.id,
      name: branch.name,
      enabled: branch.enabled,
      maxDrawPerSecond: branch.maxDrawPerSecond,
      consumedTotal: branch.consumedTotal,
      consumptionRate: branch.lastConsumptionRate
    });
  }

  function getBranch(id) {
    const branch = branches.get(String(id));
    if (!branch) throw new Error('Ramificação não registrada: ' + id);
    return branch;
  }

  function energy() {
    return clamp(state.deflectorCoreEnergy, 0, capacity);
  }

  return Object.freeze({
    registerBranch,
    setBranchEnabled,
    consumeEnergy,
    update,
    setEnabled,
    setChargingEnabled,
    snapshot
  });
}

function positive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value)));
}
