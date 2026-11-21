// Núcleo energético independente do defletor de navegação.
// Recebe energia da reserva principal e distribui apenas a reserva local.
const DEFAULT_CAPACITY = 100;
const DEFAULT_CHARGE_RATE = 2;
const EPSILON = 1e-9;

export function createDeflectorCoreSystem(state, options = {}) {
  if (!state || typeof state !== 'object') throw new TypeError('O estado da nave é obrigatório.');

  const capacity = positive(options.capacity, DEFAULT_CAPACITY);
  const chargeRate = positive(options.chargeRate, DEFAULT_CHARGE_RATE);
  const primaryReserveKey = options.primaryReserveKey || 'refinedDilithium';

  state.deflectorCoreEnergy = clamp(state.deflectorCoreEnergy, 0, capacity);
  state.deflectorCoreEnabled = state.deflectorCoreEnabled !== false;
  state.deflectorCoreChargingEnabled = state.deflectorCoreChargingEnabled !== false;
  state.deflectorCoreTransferredTotal = nonNegative(state.deflectorCoreTransferredTotal);
  state.deflectorCoreConsumedTotal = nonNegative(state.deflectorCoreConsumedTotal);
  if (!isPlainObject(state.deflectorBranchConsumptionTotals)) state.deflectorBranchConsumptionTotals = {};

  const branches = new Map();
  let lastTransferAmount = 0;
  let lastTransferRate = 0;
  let lastConsumptionAmount = 0;
  let lastConsumptionRate = 0;

  function registerBranch(id, config = {}) {
    const key = String(id || '').trim();
    if (!key) throw new TypeError('A ramificação precisa de um identificador.');
    if (branches.has(key)) throw new Error('Ramificação já registrada: ' + key);
    const persistedTotal = nonNegative(state.deflectorBranchConsumptionTotals[key]);
    branches.set(key, {
      id: key,
      name: String(config.name || key),
      maxDrawPerSecond: positive(config.maxDrawPerSecond, Number.MAX_SAFE_INTEGER),
      enabled: config.enabled !== false,
      consumedTotal: persistedTotal,
      frameConsumption: 0,
      lastConsumptionRate: 0
    });
    return branchSnapshot(branches.get(key));
  }

  function setBranchEnabled(id, enabled) {
    const branch = getBranch(id);
    branch.enabled = Boolean(enabled);
    if (!branch.enabled) {
      branch.frameConsumption = 0;
      branch.lastConsumptionRate = 0;
    }
    return branchSnapshot(branch);
  }

  // O limite é calculado com o dt real da chamada. O acumulador por frame
  // impede que chamadas repetidas ultrapassem a taxa máxima da ramificação.
  function consumeEnergy(id, requestedAmount, deltaSeconds) {
    const branch = getBranch(id);
    const requested = Math.max(0, finite(requestedAmount));
    const dt = Math.max(0, finite(deltaSeconds));
    if (requested <= EPSILON) {
      return Object.freeze({ accepted: true, consumed: 0, requested, remaining: energy() });
    }
    if (!state.deflectorCoreEnabled || !branch.enabled || dt <= 0 || energy() <= EPSILON) {
      return Object.freeze({ accepted: false, consumed: 0, requested, remaining: energy() });
    }

    const frameAllowance = Math.max(0, branch.maxDrawPerSecond * dt - branch.frameConsumption);
    const consumed = Math.min(energy(), requested, frameAllowance);
    if (consumed > 0) {
      branch.frameConsumption += consumed;
      branch.consumedTotal += consumed;
      branch.lastConsumptionRate = dt > 0 ? branch.frameConsumption / dt : 0;
      state.deflectorCoreEnergy = energy() - consumed;
      state.deflectorCoreConsumedTotal += consumed;
      state.deflectorBranchConsumptionTotals[branch.id] = branch.consumedTotal;
      lastConsumptionAmount += consumed;
      lastConsumptionRate += consumed / dt;
    }

    return Object.freeze({
      accepted: consumed >= requested - EPSILON,
      consumed,
      requested,
      remaining: energy()
    });
  }

  function update(deltaSeconds) {
    const dt = Math.max(0, finite(deltaSeconds));
    lastTransferAmount = 0;
    lastTransferRate = 0;
    lastConsumptionAmount = 0;
    lastConsumptionRate = 0;

    for (const branch of branches.values()) {
      branch.frameConsumption = 0;
      branch.lastConsumptionRate = 0;
    }

    if (state.deflectorCoreEnabled && state.deflectorCoreChargingEnabled && dt > 0) {
      const source = Math.max(0, finite(state[primaryReserveKey]));
      const room = Math.max(0, capacity - energy());
      const transferred = Math.min(source, room, chargeRate * dt);
      if (transferred > 0) {
        state[primaryReserveKey] = source - transferred;
        state.deflectorCoreEnergy = energy() + transferred;
        state.deflectorCoreTransferredTotal += transferred;
        lastTransferAmount = transferred;
        lastTransferRate = transferred / dt;
      }
    }
    return snapshot();
  }

  function setEnabled(enabled) {
    state.deflectorCoreEnabled = Boolean(enabled);
    return snapshot();
  }

  function setChargingEnabled(enabled) {
    state.deflectorCoreChargingEnabled = Boolean(enabled);
    return snapshot();
  }

  function snapshot() {
    const current = energy();
    return Object.freeze({
      enabled: Boolean(state.deflectorCoreEnabled),
      chargingEnabled: Boolean(state.deflectorCoreChargingEnabled),
      primaryReserve: Math.max(0, finite(state[primaryReserveKey])),
      energy: current,
      capacity,
      fill: capacity > 0 ? current / capacity : 0,
      transferAmount: lastTransferAmount,
      transferRate: lastTransferRate,
      transferredTotal: nonNegative(state.deflectorCoreTransferredTotal),
      consumptionAmount: lastConsumptionAmount,
      consumptionRate: lastConsumptionRate,
      consumedTotal: nonNegative(state.deflectorCoreConsumedTotal),
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
      consumptionRate: branch.lastConsumptionRate,
      available: Boolean(state.deflectorCoreEnabled && branch.enabled && energy() > EPSILON)
    });
  }

  function getBranch(id) {
    const branch = branches.get(String(id));
    if (!branch) throw new Error('Ramificação não registrada: ' + id);
    return branch;
  }

  function energy() {
    const current = clamp(state.deflectorCoreEnergy, 0, capacity);
    state.deflectorCoreEnergy = current;
    return current;
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

function nonNegative(value) {
  return Math.max(0, finite(value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value)));
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
