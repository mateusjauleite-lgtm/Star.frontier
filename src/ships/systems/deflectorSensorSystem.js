// Ramificação de sensores do defletor.
// A detecção de objetos será conectada ao subsistema existente, sem duplicá-lo.
const DEFAULT_DRAW_PER_SECOND = 0.65;

export function createDeflectorSensorSystem(core, options = {}) {
  if (!core || typeof core.registerBranch !== 'function' || typeof core.consumeEnergy !== 'function') {
    throw new TypeError('O núcleo energético do defletor é obrigatório.');
  }
  const branchId = options.branchId || 'deflector-sensors';
  const energyPerSecond = positive(options.energyPerSecond, DEFAULT_DRAW_PER_SECOND);
  core.registerBranch(branchId, {
    name: 'Sensores de proximidade',
    maxDrawPerSecond: energyPerSecond,
    enabled: options.enabled === true
  });
  let enabled = options.enabled === true;
  let operational = false;
  let signalQuality = 0;
  let contacts = [];

  function update(deltaSeconds, input = {}) {
    const dt = Math.max(0, finite(deltaSeconds));
    contacts = Array.isArray(input.contacts) ? input.contacts : [];
    operational = false;
    signalQuality = 0;
    if (!enabled || dt <= 0) return snapshot();
    const requested = energyPerSecond * dt;
    const result = core.consumeEnergy(branchId, requested, dt);
    signalQuality = requested > 0 ? result.consumed / requested : 0;
    operational = result.accepted;
    return snapshot();
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    core.setBranchEnabled(branchId, enabled);
    if (!enabled) {
      operational = false;
      signalQuality = 0;
    }
    return snapshot();
  }

  function snapshot() {
    return Object.freeze({ id: branchId, enabled, operational, signalQuality, energyPerSecond, contacts, totalContacts: contacts.length });
  }

  return Object.freeze({ update, setEnabled, snapshot });
}

function positive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
