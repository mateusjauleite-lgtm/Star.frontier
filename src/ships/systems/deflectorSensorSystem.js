// Ramificação de sensores do defletor.
// Esta camada controla alimentação e disponibilidade; a detecção de objetos
// será conectada ao subsistema de sensores existente, sem criar um detector duplicado.
const DEFAULT_DRAW_PER_SECOND = 0.65;

export function createDeflectorSensorSystem(core, options = {}) {
  if (!core || typeof core.registerBranch !== 'function' || typeof core.consumeEnergy !== 'function') {
    throw new TypeError('O núcleo energético do defletor é obrigatório.');
  }
  const branchId = options.branchId || 'deflector-sensors';
  const energyPerSecond = positive(options.energyPerSecond, DEFAULT_DRAW_PER_SECOND);
  core.registerBranch(branchId, {
    name: 'Sensores de proximidade',
    maxDrawPerSecond: energyPerSecond
  });
  let enabled = options.enabled !== false;
  let operational = false;
  let signalQuality = 0;

  function update(deltaSeconds) {
    const dt = clamp(deltaSeconds, 0, 0.1);
    operational = false;
    signalQuality = 0;
    if (!enabled || dt <= 0) return snapshot();
    const requested = energyPerSecond * dt;
    const result = core.consumeEnergy(branchId, requested);
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
    return Object.freeze({ id: branchId, enabled, operational, signalQuality, energyPerSecond });
  }

  return Object.freeze({ update, setEnabled, snapshot });
}

function positive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
function clamp(value, min, max) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}
