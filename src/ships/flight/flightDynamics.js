/**
 * Atualiza propulsão convencional e dobra em cinco estágios.
 * A dobra mantém velocidade de cruzeiro e consome dilítio refinado em unidades reais.
 */
export const WARP_STAGE_SPEEDS = Object.freeze([0, 115, 155, 205, 270, 350]);
export const WARP_DILITHIUM_CONSUMPTION = Object.freeze([0, 0.008, 0.014, 0.022, 0.032, 0.045]);
export const WARP_POWER_CONSUMPTION = Object.freeze([0, 2.0, 2.8, 3.8, 5.2, 7.5]);

const MAX_DELTA_SECONDS = 0.04;
const WARP_ACCELERATION = 65;
const WARP_SMOOTH_EXIT_DECELERATION = 24;
const CONVENTIONAL_MAX_SPEED = 75;

function approach(current, target, maxDelta) {
  if (current < target) return Math.min(target, current + maxDelta);
  return Math.max(target, current - maxDelta);
}

function normalizeStage(value) {
  const stage = Math.round(Number(value));
  return Number.isFinite(stage) ? Math.max(1, Math.min(5, stage)) : 5;
}

export function advanceShipFlightDynamics(state, deltaSeconds) {
  if (!state || typeof state !== 'object') {
    throw new TypeError('O estado de voo da nave é obrigatório.');
  }
  const dt = Number.isFinite(deltaSeconds)
    ? Math.max(0, Math.min(MAX_DELTA_SECONDS, deltaSeconds))
    : 0;

  const wasWarpActive = Boolean(state.warpDriveActive);
  const exitingWarp = !state.warpDriveButton && (
    wasWarpActive || state.warpTransition === 'entering' ||
    state.warpTransition === 'cruise' || state.warpTransition === 'exiting'
  );
  const hasConventionalFuel = Number(state.fuel) > 0;
  const conventionalWarpAssist = Boolean(state.throttle && hasConventionalFuel && state.warpDriveButton);
  if (state.throttle && hasConventionalFuel) {
    if (!state.warpDriveButton && !exitingWarp) {
      state.speed = Math.min(CONVENTIONAL_MAX_SPEED, state.speed + 18 * dt);
    }
    state.fuel = Math.max(0, state.fuel - 0.28 * dt);
  }

  const refinedDilithium = Math.max(0, Number(state.refinedDilithium) || 0);
  const plasma = state.plasma === undefined ? refinedDilithium : Math.max(0, Number(state.plasma) || 0);
  const hasCorePowerSystem = Boolean(state.warpCorePowerBusConnected);
  const requestedWarp = Boolean(state.warpDriveButton && (hasCorePowerSystem ? (plasma > 0 || Number(state.warpCoreWarpBuffer) > 0) : refinedDilithium > 0));
  let warpPowerRejected = false;
  if (requestedWarp && state.warpCorePowerBusConnected) {
    const stage = normalizeStage(state.warpStage);
    const requestedPower = WARP_POWER_CONSUMPTION[stage] * dt;
    const deliveredPower = typeof state.requestWarpPower === 'function'
      ? Math.max(0, Number(state.requestWarpPower(requestedPower, dt)) || 0)
      : 0;
    warpPowerRejected = deliveredPower + 1e-9 < requestedPower;
    if (warpPowerRejected) {
      state.warpDriveButton = false;
      state.warpShutdownReason = 'insufficient-warp-power';
    }
  }

  if (requestedWarp && !warpPowerRejected) {
    const stage = normalizeStage(state.warpStage);
    const targetSpeed = WARP_STAGE_SPEEDS[stage];
    state.warpStage = stage;
    state.warpCurrentStage = stage;
    state.warpTargetSpeed = targetSpeed;
    state.warpDriveActive = true;
    state.warpShutdownReason = null;
    state.warpTransition = state.speed + 0.5 < targetSpeed ? 'entering' : state.speed > targetSpeed + 0.5 ? 'reducing' : 'cruise';

    // A aceleração de dobra é contínua; mudar de estágio nunca zera a velocidade.
    if (!state.braking) state.speed = approach(state.speed, targetSpeed, WARP_ACCELERATION * dt);
    if (conventionalWarpAssist) state.speed += 18 * dt;
    if (!hasCorePowerSystem) {
      const consumption = WARP_DILITHIUM_CONSUMPTION[stage] * dt;
      state.warpDilithiumConsumedTotal = Math.max(0, Number(state.warpDilithiumConsumedTotal) || 0) + consumption;
      state.refinedDilithium = Math.max(0, refinedDilithium - consumption);
    }
    if (hasCorePowerSystem ? (Number(state.plasma) <= 0 && Number(state.warpCoreWarpBuffer) <= 0) : state.refinedDilithium <= 0) {
      state.warpDriveButton = false;
      state.warpDriveActive = false;
      state.warpCurrentStage = 0;
      state.warpTransition = 'exiting';
      state.warpShutdownReason = hasCorePowerSystem ? 'plasma-depleted' : 'dilithium-depleted';
    }
  } else {
    state.warpDriveActive = false;
    state.warpCurrentStage = 0;
    state.warpTargetSpeed = 0;

    if (wasWarpActive || state.warpTransition === 'entering' || state.warpTransition === 'cruise') {
      state.warpTransition = 'exiting';
    }

    if (state.warpTransition === 'exiting') {
      if (state.warpExitMode === 'direct') {
        // Saída direta abandona o campo de dobra sem zerar o deslocamento.
        state.speed = Math.max(0, Math.min(state.speed, CONVENTIONAL_MAX_SPEED));
        state.warpTransition = 'idle';
      } else {
        state.speed = approach(state.speed, Math.min(state.speed, CONVENTIONAL_MAX_SPEED), WARP_SMOOTH_EXIT_DECELERATION * dt);
        if (state.speed <= CONVENTIONAL_MAX_SPEED + 0.5) {
          state.speed = Math.min(state.speed, CONVENTIONAL_MAX_SPEED);
          state.warpTransition = 'idle';
        }
      }
    } else if (!state.throttle) {
      state.speed = Math.max(0, state.speed - 1.4 * dt);
    }
  }

  if (state.braking) {
    state.speed = Math.max(0, state.speed - 30 * dt);
  }

  state.speed = Math.max(0, Number(state.speed) || 0);
  return Boolean(state.warpDriveActive);
}
