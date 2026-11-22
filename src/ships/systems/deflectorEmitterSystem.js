// Ramificação emissora frontal do defletor de navegação.
// A geometria/campo físico será conectada à simulação de colisões em etapa própria.
const DEFAULT_DRAW_PER_SECOND = 1.8;

export function createDeflectorEmitterSystem(core, options = {}) {
  if (!core || typeof core.registerBranch !== 'function' || typeof core.consumeEnergy !== 'function') {
    throw new TypeError('O núcleo energético do defletor é obrigatório.');
  }
  const branchId = options.branchId || 'deflector-emitter';
  const energyPerSecond = positive(options.energyPerSecond, DEFAULT_DRAW_PER_SECOND);
  core.registerBranch(branchId, {
    name: 'Emissor frontal',
    maxDrawPerSecond: energyPerSecond,
    enabled: options.enabled === true
  });
  let enabled = options.enabled === true;
  let active = false;
  let fieldStrength = 0;

  function update(deltaSeconds) {
    const dt = Math.max(0, finite(deltaSeconds));
    active = false;
    fieldStrength = 0;
    if (!enabled || dt <= 0) return snapshot();
    const requested = energyPerSecond * dt;
    const result = core.consumeEnergy(branchId, requested, dt);
    fieldStrength = requested > 0 ? result.consumed / requested : 0;
    active = result.consumed > 0;
    return snapshot();
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    core.setBranchEnabled(branchId, enabled);
    if (!enabled) {
      active = false;
      fieldStrength = 0;
    }
    return snapshot();
  }

  function snapshot() {
    return Object.freeze({ id: branchId, enabled, active, fieldStrength, energyPerSecond });
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
