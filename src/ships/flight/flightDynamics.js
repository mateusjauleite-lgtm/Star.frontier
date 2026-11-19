/**
 * Atualiza aceleração, nitro, consumo de recursos e frenagem da nave.
 * Mantém a escala de velocidade de gameplay existente; não representa m/s.
 */
export function advanceShipFlightDynamics(state, deltaSeconds) {
  if (!state || typeof state !== 'object') {
    throw new TypeError('O estado de voo da nave é obrigatório.');
  }
  const dt = Number.isFinite(deltaSeconds)
    ? Math.max(0, Math.min(0.04, deltaSeconds))
    : 0;

  if (state.throttle && state.fuel > 0) {
    state.speed = Math.min(75, state.speed + 18 * dt);
    state.fuel = Math.max(0, state.fuel - 0.28 * dt);
  }

  const boosting = Boolean(state.nitroButton && state.nitro > 0 && state.fuel > 0);
  if (boosting) {
    state.speed = Math.min(115, state.speed + 55 * dt);
    state.nitro = Math.max(0, state.nitro - 28 * dt);
    state.fuel = Math.max(0, state.fuel - 0.55 * dt);
  } else {
    state.nitro = Math.min(100, state.nitro + 12 * dt);
  }

  if (state.braking) {
    state.speed = Math.max(0, state.speed - 30 * dt);
  }

  if (!state.throttle && !boosting) {
    state.speed = Math.max(0, state.speed - 1.4 * dt);
  }

  return boosting;
}
