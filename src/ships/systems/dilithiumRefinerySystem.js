// Refinaria de dilítio e alimentação do núcleo da nave.
// Mantém separados minério bruto, produto refinado em buffer e reserva do núcleo.
const MAX_DELTA_SECONDS = 0.1;
const REFINING_UNITS_PER_SECOND = 0.08;
const TRANSFER_UNITS_PER_SECOND = 0.06;
const DEFAULT_RAW_CAPACITY = 200;
const DEFAULT_REFINED_CAPACITY = 120;
const DEFAULT_CORE_CAPACITY = 250;

export function createDilithiumRefinerySystem(state, options = {}) {
  if (!state || typeof state !== 'object') throw new TypeError('O estado da nave é obrigatório.');
  const rawCapacity = positive(options.rawCapacity, DEFAULT_RAW_CAPACITY);
  const refinedCapacity = positive(options.refinedCapacity, DEFAULT_REFINED_CAPACITY);
  const coreCapacity = positive(options.coreCapacity, DEFAULT_CORE_CAPACITY);
  const refiningRate = positive(options.refiningRate, REFINING_UNITS_PER_SECOND);
  const transferRate = positive(options.transferRate, TRANSFER_UNITS_PER_SECOND);
  state.rawDilithiumOre = clamp(state.rawDilithiumOre, 0, rawCapacity);
  state.refineryRefinedStorage = clamp(state.refineryRefinedStorage, 0, refinedCapacity);
  state.refinedDilithium = clamp(state.refinedDilithium, 0, coreCapacity);
  state.refineryEnabled = state.refineryEnabled !== false;
  state.refineryTransferEnabled = state.refineryTransferEnabled === true;
  let refinedTotal = Math.max(0, Number(state.refineryRefinedTotal) || 0);
  let transferredTotal = Math.max(0, Number(state.refineryTransferredTotal) || 0);
  let consumedTotal = Math.max(0, Number(state.coreDilithiumConsumedTotal) || 0);
  let lastCoreAmount = state.refinedDilithium;
  let hasObservedCore = false;
  let lastTransferRate = 0;
  let lastRefiningRate = 0;

  function update(deltaSeconds) {
    const dt = clamp(deltaSeconds, 0, MAX_DELTA_SECONDS);
    const currentCore = clamp(state.refinedDilithium, 0, coreCapacity);
    if (!hasObservedCore) {
      lastCoreAmount = currentCore;
      hasObservedCore = true;
    } else if (currentCore < lastCoreAmount) {
      consumedTotal += lastCoreAmount - currentCore;
    }
    lastCoreAmount = currentCore;
    lastTransferRate = 0;
    lastRefiningRate = 0;

    if (state.refineryEnabled && dt > 0) {
      const raw = clamp(state.rawDilithiumOre, 0, rawCapacity);
      const outputSpace = Math.max(0, refinedCapacity - state.refineryRefinedStorage);
      const refined = Math.min(raw, outputSpace, refiningRate * dt);
      if (refined > 0) {
        state.rawDilithiumOre = raw - refined;
        state.refineryRefinedStorage += refined;
        refinedTotal += refined;
        lastRefiningRate = refined / dt;
      }
    }

    if (state.refineryEnabled && state.refineryTransferEnabled && dt > 0) {
      const coreSpace = Math.max(0, coreCapacity - state.refinedDilithium);
      const amount = Math.min(state.refineryRefinedStorage, coreSpace, transferRate * dt);
      if (amount > 0) {
        state.refineryRefinedStorage -= amount;
        state.refinedDilithium += amount;
        transferredTotal += amount;
        lastTransferRate = amount / dt;
      }
    }
    lastCoreAmount = clamp(state.refinedDilithium, 0, coreCapacity);
    state.refineryRefinedTotal = refinedTotal;
    state.refineryTransferredTotal = transferredTotal;
    state.coreDilithiumConsumedTotal = consumedTotal;
    return snapshot();
  }

  function setRefineryEnabled(enabled) {
    state.refineryEnabled = Boolean(enabled);
    if (!state.refineryEnabled) lastRefiningRate = 0;
    return snapshot();
  }

  function setTransferEnabled(enabled) {
    state.refineryTransferEnabled = Boolean(enabled);
    if (!state.refineryTransferEnabled) lastTransferRate = 0;
    return snapshot();
  }

  function snapshot() {
    const raw = clamp(state.rawDilithiumOre, 0, rawCapacity);
    const buffer = clamp(state.refineryRefinedStorage, 0, refinedCapacity);
    const core = clamp(state.refinedDilithium, 0, coreCapacity);
    return Object.freeze({
      refineryEnabled: Boolean(state.refineryEnabled),
      transferEnabled: Boolean(state.refineryTransferEnabled),
      rawOre: raw,
      rawCapacity,
      refinedBuffer: buffer,
      refinedCapacity,
      coreDilithium: core,
      coreCapacity,
      coreFill: coreCapacity > 0 ? core / coreCapacity : 0,
      refiningRate: lastRefiningRate,
      transferRate: lastTransferRate,
      refinedTotal,
      transferredTotal,
      consumedTotal,
      coreRemainingCapacity: Math.max(0, coreCapacity - core),
      supportRange: core > 0 ? 'NÚCLEO ATIVO · PROPULSÃO DE DOBRA' : 'NÚCLEO SEM RESERVA',
      supportSystems: ['Propulsão de dobra']
    });
  }

  return Object.freeze({ update, snapshot, setRefineryEnabled, setTransferEnabled });
}

function positive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clamp(value, min, max) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? number : min));
}
