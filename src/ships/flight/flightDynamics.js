import { CONVENTIONAL_MAX_SPEED_MPS } from '../systems/maneuveringThrusterSystem.js';

// Velocidades de dobra em múltiplos explícitos da velocidade da luz (c).
export const WARP_STAGE_SPEEDS = Object.freeze([0, 1, 5, 25, 125, 625]);
export const WARP_DILITHIUM_CONSUMPTION = Object.freeze([0, 0.008, 0.014, 0.022, 0.032, 0.045]);
export const WARP_POWER_CONSUMPTION = Object.freeze([0, 2.0, 2.8, 3.8, 5.2, 7.5]);

const MAX_DELTA_SECONDS = 0.04;
const CONVENTIONAL_ACCELERATION_MPS2 = 240;
const CONVENTIONAL_BRAKING_MPS2 = 600;
const CONVENTIONAL_DRAG_MPS2 = 2.4;
const WARP_ACCELERATION_C_PER_SECOND = 250;
const WARP_EXIT_DECELERATION_C_PER_SECOND = 250;

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
    state.warpTransition === 'cruise' || state.warpTransition === 'exiting' ||
    Number(state.warpSpeedC) > 0
  );

  if (state.warpDriveButton && state.warpSafetyLock) {
    state.warpDriveButton = false;
    state.warpShutdownReason = 'planetary-proximity';
  }

  const hasConventionalFuel = Number(state.fuel) > 0;
  const refinedDilithium = Math.max(0, Number(state.refinedDilithium) || 0);
  const plasma = state.plasma === undefined ? refinedDilithium : Math.max(0, Number(state.plasma) || 0);
  const hasCorePowerSystem = Boolean(state.warpCorePowerBusConnected);
  const requestedWarp = Boolean(state.warpDriveButton && (
    hasCorePowerSystem
      ? (plasma > 0 || Number(state.warpCoreWarpBuffer) > 0)
      : refinedDilithium > 0
  ));

  if (state.throttle && hasConventionalFuel) {
    if (!requestedWarp && !exitingWarp) {
      const limit = Number.isFinite(state.conventionalSpeedLimit)
        ? Math.max(0, Math.min(CONVENTIONAL_MAX_SPEED_MPS, state.conventionalSpeedLimit))
        : CONVENTIONAL_MAX_SPEED_MPS;
      state.speed = Math.min(limit, Math.max(0, Number(state.speed) || 0) + CONVENTIONAL_ACCELERATION_MPS2 * dt);
    }
    state.fuel = Math.max(0, state.fuel - 0.28 * dt);
  }

  let warpPowerRejected = false;
  if (requestedWarp && hasCorePowerSystem) {
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
    const targetSpeedC = WARP_STAGE_SPEEDS[stage];
    state.warpStage = stage;
    state.warpCurrentStage = stage;
    state.warpTargetSpeed = targetSpeedC;
    state.warpSpeedC = approach(Math.max(0, Number(state.warpSpeedC) || 0), targetSpeedC, WARP_ACCELERATION_C_PER_SECOND * dt);
    state.warpDriveActive = true;
    state.warpShutdownReason = null;
    state.warpTransition = state.warpSpeedC + 0.01 < targetSpeedC
      ? 'entering'
      : state.warpSpeedC > targetSpeedC + 0.01 ? 'reducing' : 'cruise';

    if (!hasCorePowerSystem) {
      const consumption = WARP_DILITHIUM_CONSUMPTION[stage] * dt;
      state.warpDilithiumConsumedTotal = Math.max(0, Number(state.warpDilithiumConsumedTotal) || 0) + consumption;
      state.refinedDilithium = Math.max(0, refinedDilithium - consumption);
    }
    if (hasCorePowerSystem
      ? (Number(state.plasma) <= 0 && Number(state.warpCoreWarpBuffer) <= 0)
      : state.refinedDilithium <= 0) {
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
    if (wasWarpActive || state.warpTransition === 'entering' || state.warpTransition === 'cruise' || Number(state.warpSpeedC) > 0) {
      state.warpTransition = 'exiting';
    }
    if (state.warpTransition === 'exiting') {
      state.warpSpeedC = approach(Math.max(0, Number(state.warpSpeedC) || 0), 0, WARP_EXIT_DECELERATION_C_PER_SECOND * dt);
      if (state.warpSpeedC <= 0.001) {
        state.warpSpeedC = 0;
        state.warpTransition = 'idle';
      }
    } else if (!state.throttle) {
      state.speed = Math.max(0, (Number(state.speed) || 0) - CONVENTIONAL_DRAG_MPS2 * dt);
    }
  }

  if (state.braking) {
    state.speed = Math.max(0, (Number(state.speed) || 0) - CONVENTIONAL_BRAKING_MPS2 * dt);
  }

  const speedLimit = Number.isFinite(state.conventionalSpeedLimit)
    ? Math.max(0, Math.min(CONVENTIONAL_MAX_SPEED_MPS, state.conventionalSpeedLimit))
    : CONVENTIONAL_MAX_SPEED_MPS;
  state.speed = Math.max(0, Math.min(speedLimit, Number(state.speed) || 0));
  state.warpSpeedC = Math.max(0, Number(state.warpSpeedC) || 0);
  return Boolean(state.warpDriveActive);
}
