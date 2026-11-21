/**
 * Safe bridge between SI orbital telemetry and gameplay flight.
 *
 * This stage only produces bounded advisory corrections. It never mutates
 * ship transforms or gameplay speed. Actual actuation remains disabled until
 * a measured world/gameplay scale has passed calibration.
 */
const VECTOR_AXES = 3;

function validVector(value) {
  return Array.isArray(value) && value.length === VECTOR_AXES &&
    value.every(Number.isFinite);
}

function magnitude(vector) {
  return Math.hypot(...vector);
}

export function createOrbitalFlightAuthority({
  maximumDeltaVelocityMetersPerSecond = 0.02,
  maximumBlend = 0.05
} = {}) {
  if (!Number.isFinite(maximumDeltaVelocityMetersPerSecond) ||
      maximumDeltaVelocityMetersPerSecond <= 0 ||
      !Number.isFinite(maximumBlend) ||
      maximumBlend <= 0 || maximumBlend > 0.05) {
    throw new RangeError('Os limites da autoridade orbital precisam ser positivos e conservadores.');
  }

  let calibration = null;
  let proposalEnabled = false;

  function snapshot() {
    return Object.freeze({
      calibrated: Boolean(calibration),
      proposalEnabled,
      authority: proposalEnabled ? 'bounded-proposal-only' : 'telemetry-only',
      actuationEnabled: false,
      worldUnitsPerMeter: calibration?.worldUnitsPerMeter ?? null,
      validationSamples: calibration?.validationSamples ?? 0,
      maximumBlend
    });
  }

  function calibrate({
    worldUnitsPerMeter,
    validationSamples,
    maximumResidualMeters
  } = {}) {
    if (!Number.isFinite(worldUnitsPerMeter) || worldUnitsPerMeter <= 0 ||
        !Number.isInteger(validationSamples) || validationSamples < 3 ||
        !Number.isFinite(maximumResidualMeters) ||
        maximumResidualMeters < 0 || maximumResidualMeters > 2) {
      calibration = null;
      proposalEnabled = false;
      return false;
    }

    calibration = Object.freeze({
      worldUnitsPerMeter,
      validationSamples,
      maximumResidualMeters
    });
    proposalEnabled = false;
    return true;
  }

  function setProposalEnabled(enabled, blend = maximumBlend) {
    if (!enabled) {
      proposalEnabled = false;
      return true;
    }
    if (!calibration || !Number.isFinite(blend) ||
        blend <= 0 || blend > maximumBlend) return false;
    proposalEnabled = true;
    return true;
  }

  function proposeCorrection({
    gravityAccelerationMetersPerSecond2,
    deltaSeconds,
    blend = maximumBlend
  } = {}) {
    if (!proposalEnabled || !calibration ||
        !validVector(gravityAccelerationMetersPerSecond2) ||
        !Number.isFinite(deltaSeconds) || deltaSeconds <= 0 ||
        deltaSeconds > 0.04 || !Number.isFinite(blend) ||
        blend <= 0 || blend > maximumBlend) return null;

    const scaled = gravityAccelerationMetersPerSecond2.map(
      value => value * deltaSeconds * blend
    );
    const length = magnitude(scaled);
    const scale = length > maximumDeltaVelocityMetersPerSecond
      ? maximumDeltaVelocityMetersPerSecond / length
      : 1;
    const deltaVelocityMetersPerSecond = scaled.map(value => value * scale);
    const proposedDisplacementWorldUnits = deltaVelocityMetersPerSecond.map(
      value => value * deltaSeconds * calibration.worldUnitsPerMeter
    );

    return Object.freeze({
      deltaVelocityMetersPerSecond,
      proposedDisplacementWorldUnits,
      blend,
      source: 'orbital-gravity-advisory',
      authority: 'bounded-proposal-only',
      actuationEnabled: false
    });
  }

  return Object.freeze({
    snapshot,
    calibrate,
    setProposalEnabled,
    proposeCorrection
  });
}
