export const EARTH_STANDARD_GRAVITY_MPS2 = 9.80665;
export const SPEED_OF_LIGHT_MPS = 299792458;
export const CONVENTIONAL_MAX_SPEED_MPS = 12000;
export const MANEUVER_LATERAL_ACCELERATION_MPS2 = 14;
export const MANEUVER_VERTICAL_ACCELERATION_MPS2 = 18;
export const MANEUVER_ASSIST_MAX_ALTITUDE_METERS = 25000;

export function getConventionalSpeedLimit(altitudeMeters) {
  if (!Number.isFinite(altitudeMeters)) return CONVENTIONAL_MAX_SPEED_MPS;
  if (altitudeMeters <= 100) return 4;
  if (altitudeMeters <= 1000) return 12;
  if (altitudeMeters <= 10000) return 60;
  if (altitudeMeters <= 100000) return 300;
  return CONVENTIONAL_MAX_SPEED_MPS;
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);

export function calculateManeuveringAcceleration({
  gravityAcceleration = [0, 0, 0],
  radialUp = [0, 1, 0],
  shipRight = [1, 0, 0],
  lateralInput = 0,
  verticalInput = 0,
  altitudeMeters = Infinity,
  assistEnabled = true,
  radialVelocity = 0
} = {}) {
  if (![gravityAcceleration, radialUp, shipRight].every(v =>
    Array.isArray(v) && v.length === 3 && v.every(Number.isFinite)
  )) return [0, 0, 0];

  const acceleration = [0, 0, 0];
  const assistActive = assistEnabled && altitudeMeters >= 0 &&
    altitudeMeters <= MANEUVER_ASSIST_MAX_ALTITUDE_METERS;

  if (assistActive) {
    for (let axis = 0; axis < 3; axis += 1) {
      acceleration[axis] -= gravityAcceleration[axis];
    }
    const damping = clamp(-radialVelocity * 2.5, -30, 30);
    for (let axis = 0; axis < 3; axis += 1) {
      acceleration[axis] += radialUp[axis] * damping;
    }
  }

  const lateral = clamp(Number(lateralInput) || 0, -1, 1) * MANEUVER_LATERAL_ACCELERATION_MPS2;
  const vertical = clamp(Number(verticalInput) || 0, -1, 1) * MANEUVER_VERTICAL_ACCELERATION_MPS2;
  for (let axis = 0; axis < 3; axis += 1) {
    acceleration[axis] += shipRight[axis] * lateral + radialUp[axis] * vertical;
  }
  return acceleration;
}

export function integrateWorldVelocity(velocity, acceleration, deltaSeconds, maximumSpeed = 1200) {
  if (!Array.isArray(velocity) || velocity.length !== 3 ||
      !Array.isArray(acceleration) || acceleration.length !== 3 ||
      !velocity.every(Number.isFinite) || !acceleration.every(Number.isFinite) ||
      !Number.isFinite(deltaSeconds) || deltaSeconds < 0) return null;
  const next = velocity.map((value, axis) => value + acceleration[axis] * deltaSeconds);
  const speed = Math.hypot(...next);
  if (speed > maximumSpeed && speed > 0) {
    const factor = maximumSpeed / speed;
    return next.map(value => value * factor);
  }
  return next;
}

export function projectRadialVelocity(velocity, radialUp) {
  if (!Array.isArray(velocity) || !Array.isArray(radialUp) ||
      velocity.length !== 3 || radialUp.length !== 3) return 0;
  return dot(velocity, radialUp);
}
