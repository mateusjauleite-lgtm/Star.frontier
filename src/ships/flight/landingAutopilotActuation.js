const validVector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

const clampMagnitude = (vector, maximum) => {
  const magnitude = Math.hypot(...vector);
  if (!Number.isFinite(magnitude) || magnitude <= maximum || magnitude === 0) return vector;
  return vector.map(value => value * maximum / magnitude);
};

function rotateByQuaternion([x, y, z], [qx, qy, qz, qw]) {
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  return [
    x + qw * tx + (qy * tz - qz * ty),
    y + qw * ty + (qz * tx - qx * tz),
    z + qw * tz + (qx * ty - qy * tx)
  ];
}

/**
 * Converts the landing kernel's [east, up, north] velocity error into a
 * bounded world-space acceleration command. Three.js local forward is -Z,
 * hence north is mapped to local -Z before rotating into the world frame.
 */
export function calculateLandingActuationAcceleration({
  desiredVelocityMetersPerSecond,
  currentVelocityMetersPerSecond,
  platformWorldQuaternion,
  proportionalGain = 2.4,
  maximumAcceleration = 12
} = {}) {
  if (!validVector(desiredVelocityMetersPerSecond) ||
      !validVector(currentVelocityMetersPerSecond) ||
      !Array.isArray(platformWorldQuaternion) ||
      platformWorldQuaternion.length !== 4 ||
      !platformWorldQuaternion.every(Number.isFinite) ||
      !Number.isFinite(proportionalGain) || proportionalGain < 0 ||
      !Number.isFinite(maximumAcceleration) || maximumAcceleration <= 0) return null;

  const quaternionLength = Math.hypot(...platformWorldQuaternion);
  if (quaternionLength < 1e-9) return null;
  const quaternion = platformWorldQuaternion.map(value => value / quaternionLength);
  const localAcceleration = desiredVelocityMetersPerSecond.map((value, axis) =>
    (value - currentVelocityMetersPerSecond[axis]) * proportionalGain
  );
  const bounded = clampMagnitude(localAcceleration, maximumAcceleration);
  const world = rotateByQuaternion([bounded[0], bounded[1], -bounded[2]], quaternion);
  return world.every(Number.isFinite) ? world : null;
}
