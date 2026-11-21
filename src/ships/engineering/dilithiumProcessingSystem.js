export const DILITHIUM_COMPONENT_IDS = Object.freeze({
  RAW_STORAGE: 'storage:raw-dilithium',
  REFINERY: 'machine:dilithium-refinery',
  REFINED_STORAGE: 'storage:refined-dilithium',
  WARP_CORE: 'system:warp-core'
});

export const DILITHIUM_RECOGNITION_PRIORITY = Object.freeze([
  DILITHIUM_COMPONENT_IDS.WARP_CORE,
  DILITHIUM_COMPONENT_IDS.REFINERY,
  DILITHIUM_COMPONENT_IDS.REFINED_STORAGE,
  DILITHIUM_COMPONENT_IDS.RAW_STORAGE
]);

export const DILITHIUM_STORAGE_CAPACITY = 500;
export const DILITHIUM_REFINERY_RATE = 1; // unidades de minério processadas por segundo

export function createDilithiumProcessingSystem({ state, plant = null, getPlant = null } = {}) {
  if (!state) throw new TypeError('O sistema de processamento precisa do estado compartilhado da nave.');
  state.rawDilithiumOre = Math.min(DILITHIUM_STORAGE_CAPACITY, Math.max(0, Number(state.rawDilithiumOre) || 0));
  state.refinedDilithium = Math.min(DILITHIUM_STORAGE_CAPACITY, Math.max(0, Number(state.refinedDilithium) || 0));
  state.warpCoreDilithium = Math.min(DILITHIUM_STORAGE_CAPACITY, Math.max(0, Number(state.warpCoreDilithium) || 0));
  state.dilithiumRefineryActive = Boolean(state.dilithiumRefineryActive);
  let processingAccumulator = 0;
  let lastAlert = null;

  const snapshot = () => ({
    available: true,
    components: [...DILITHIUM_RECOGNITION_PRIORITY],
    recognitionPriority: [...DILITHIUM_RECOGNITION_PRIORITY],
    rawStorage: { id: DILITHIUM_COMPONENT_IDS.RAW_STORAGE, quantity: state.rawDilithiumOre, capacity: DILITHIUM_STORAGE_CAPACITY },
    refinery: {
      id: DILITHIUM_COMPONENT_IDS.REFINERY,
      active: state.dilithiumRefineryActive,
      status: state.dilithiumRefineryActive ? 'processing' : 'standby',
      rate: DILITHIUM_REFINERY_RATE,
      progress: processingAccumulator
    },
    refinedStorage: { id: DILITHIUM_COMPONENT_IDS.REFINED_STORAGE, quantity: state.refinedDilithium, capacity: DILITHIUM_STORAGE_CAPACITY },
    warpCore: { id: DILITHIUM_COMPONENT_IDS.WARP_CORE, reserve: state.warpCoreDilithium, capacity: DILITHIUM_STORAGE_CAPACITY },
    alert: lastAlert
  });

  function setRefineryActive(active) {
    if (typeof active !== 'boolean') return { accepted: false, reason: 'invalid-active-state' };
    if (active && state.rawDilithiumOre <= 0) return { accepted: false, reason: 'raw-dilithium-unavailable' };
    if (active && state.refinedDilithium >= DILITHIUM_STORAGE_CAPACITY) return { accepted: false, reason: 'refined-storage-full' };
    state.dilithiumRefineryActive = active;
    lastAlert = null;
    return { accepted: true, active, status: active ? 'processing' : 'standby' };
  }

  function transferToCore(payload = {}) {
    const requested = payload.amount == null ? DILITHIUM_STORAGE_CAPACITY : Number(payload.amount);
    if (!Number.isFinite(requested) || requested <= 0) return { accepted: false, reason: 'invalid-transfer-amount' };
    const available = Math.max(0, Number(state.refinedDilithium) || 0);
    const coreSpace = Math.max(0, DILITHIUM_STORAGE_CAPACITY - (Number(state.warpCoreDilithium) || 0));
    const amount = Math.min(requested, available, coreSpace);
    if (amount <= 0) return { accepted: false, reason: available <= 0 ? 'refined-storage-empty' : 'warp-core-full' };
    state.refinedDilithium = Math.max(0, available - amount);
    state.warpCoreDilithium = Math.min(DILITHIUM_STORAGE_CAPACITY, (Number(state.warpCoreDilithium) || 0) + amount);
    lastAlert = null;
    return { accepted: true, transferred: amount, refinedStorage: state.refinedDilithium, warpCoreReserve: state.warpCoreDilithium };
  }

  function syncMachineVisual() {
    const currentPlant = typeof getPlant === 'function' ? getPlant() : plant;
    const refineryVisual = currentPlant?.userData?.components?.refinery;
    if (refineryVisual) refineryVisual.userData.processing = Boolean(state.dilithiumRefineryActive);
    const statusLight = currentPlant?.userData?.components?.statusLight;
    if (statusLight?.material?.color?.setHex) statusLight.material.color.setHex(state.dilithiumRefineryActive ? 0x54f0b2 : 0x43dcff);
  }

  function update(deltaSeconds) {
    const dt = Math.max(0, Number(deltaSeconds) || 0);
    if (!state.dilithiumRefineryActive || dt <= 0) {
      syncMachineVisual();
      return snapshot();
    }
    if (state.rawDilithiumOre <= 0) {
      state.dilithiumRefineryActive = false;
      processingAccumulator = 0;
      lastAlert = 'raw-storage-empty';
      syncMachineVisual();
      return snapshot();
    }
    if (state.refinedDilithium >= DILITHIUM_STORAGE_CAPACITY) {
      state.dilithiumRefineryActive = false;
      processingAccumulator = 0;
      lastAlert = 'refined-storage-full';
      syncMachineVisual();
      return snapshot();
    }
    processingAccumulator += dt * DILITHIUM_REFINERY_RATE;
    while (processingAccumulator >= 1 && state.rawDilithiumOre >= 1 &&
      state.refinedDilithium < DILITHIUM_STORAGE_CAPACITY) {
      state.rawDilithiumOre -= 1;
      state.refinedDilithium = Math.min(DILITHIUM_STORAGE_CAPACITY, state.refinedDilithium + 1);
      processingAccumulator -= 1;
    }
    if (state.rawDilithiumOre < 1) {
      state.dilithiumRefineryActive = false;
      processingAccumulator = 0;
      lastAlert = 'raw-storage-empty';
    }
    if (state.refinedDilithium >= DILITHIUM_STORAGE_CAPACITY) {
      state.dilithiumRefineryActive = false;
      processingAccumulator = 0;
      lastAlert = 'refined-storage-full';
    }
    syncMachineVisual();
    return snapshot();
  }

  return Object.freeze({ snapshot, setRefineryActive, transferToCore, update });
}
