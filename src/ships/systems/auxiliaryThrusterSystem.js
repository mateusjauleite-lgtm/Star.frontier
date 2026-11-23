export const AUXILIARY_THRUSTER_ALTITUDE_METERS = 5000;
export const AUXILIARY_THRUSTER_DAMPING_PER_SECOND = 3;
export const AUXILIARY_THRUSTER_MAX_ACCELERATION_MPS2 = 12;

// Auxiliares de precisão reduzem deriva lateral durante aproximação, pairado e alinhamento.
export function calculateAuxiliaryStabilizationAcceleration({
  velocity = [0, 0, 0],
  radialUp = [0, 1, 0],
  altitudeMeters = Infinity,
  enabled = true
} = {}) {
  if (!enabled || !Number.isFinite(altitudeMeters) ||
      altitudeMeters < 0 || altitudeMeters > AUXILIARY_THRUSTER_ALTITUDE_METERS ||
      ![velocity, radialUp].every(value =>
        Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)
      )) return [0, 0, 0];

  const radialVelocity = velocity.reduce((sum, value, axis) => sum + value * radialUp[axis], 0);
  const tangentVelocity = velocity.map((value, axis) => value - radialUp[axis] * radialVelocity);
  const correction = tangentVelocity.map(value => value === 0 ? 0 : -value * AUXILIARY_THRUSTER_DAMPING_PER_SECOND);
  const magnitude = Math.hypot(...correction);
  if (magnitude > AUXILIARY_THRUSTER_MAX_ACCELERATION_MPS2) {
    const scale = AUXILIARY_THRUSTER_MAX_ACCELERATION_MPS2 / magnitude;
    return correction.map(value => value * scale);
  }
  return correction;
}
