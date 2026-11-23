/**
 * Earth gravity is a world-level field, independent of any ship controller.
 * Positions and velocities use SI units because the planetary world scale is 1 m/unit.
 */
export const EARTH_GRAVITATIONAL_PARAMETER_M3_S2 = 3.986004418e14;
export const EARTH_SIDEREAL_ROTATION_RAD_S = 7.2921150e-5;
export const EARTH_AXIAL_TILT_DEGREES = 23.439281;

const finiteVector = value =>
  Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];
const normalize = value => {
  const length = Math.hypot(...value);
  return length > 1e-12 ? value.map(component => component / length) : null;
};

export function createPlanetaryGravitySystem({
  getEarthCenter = () => [0, 0, 0],
  getEarthSpinAxis = () => [0, 1, 0],
  gravityKernel = null,
  gravitationalParameter = EARTH_GRAVITATIONAL_PARAMETER_M3_S2
} = {}) {
  if (typeof getEarthCenter !== 'function' || typeof getEarthSpinAxis !== 'function') {
    throw new TypeError('Earth gravity requires world-space center and spin-axis providers.');
  }
  if (!Number.isFinite(gravitationalParameter) || gravitationalParameter <= 0) {
    throw new RangeError('Earth gravitational parameter must be positive.');
  }

  function earthBody() {
    const position = getEarthCenter();
    return finiteVector(position) ? { position: [...position], mu: gravitationalParameter } : null;
  }

  function accelerationAt(position) {
    if (!finiteVector(position)) return null;
    const body = earthBody();
    if (!body) return null;
    const delta = position.map((value, axis) => value - body.position[axis]);
    const radiusSquared = dot(delta, delta);
    if (!Number.isFinite(radiusSquared) || radiusSquared <= 1e-12) return null;
    const result = gravityKernel?.acceleration?.({ position: [...position], bodies: [body] });
    if (finiteVector(result)) return [...result];
    const factor = -gravitationalParameter / (radiusSquared * Math.sqrt(radiusSquared));
    return delta.map(value => value * factor);
  }

  function circularOrbitVelocity(position) {
    if (!finiteVector(position)) return null;
    const body = earthBody();
    const axis = normalize(getEarthSpinAxis());
    if (!body || !axis) return null;
    const radial = position.map((value, index) => value - body.position[index]);
    const radius = Math.hypot(...radial);
    if (!Number.isFinite(radius) || radius <= 1) return null;
    const tangent = normalize(cross(axis, radial));
    if (!tangent) return null;
    const orbitalSpeed = Math.sqrt(gravitationalParameter / radius);
    return tangent.map(value => value * orbitalSpeed);
  }

  function integrate(position, velocity, deltaSeconds) {
    if (!finiteVector(position) || !finiteVector(velocity) ||
        !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return null;
    const a0 = accelerationAt(position);
    if (!a0) return null;
    const halfVelocity = velocity.map((value, axis) => value + a0[axis] * deltaSeconds * 0.5);
    const nextPosition = position.map((value, axis) => value + halfVelocity[axis] * deltaSeconds);
    const a1 = accelerationAt(nextPosition);
    if (!a1) return null;
    const nextVelocity = halfVelocity.map((value, axis) => value + a1[axis] * deltaSeconds * 0.5);
    return finiteVector(nextPosition) && finiteVector(nextVelocity)
      ? { position: nextPosition, velocity: nextVelocity }
      : null;
  }

  return Object.freeze({
    gravitationalParameter: gravitationalParameter,
    rotationAngularVelocity: EARTH_SIDEREAL_ROTATION_RAD_S,
    axialTiltDegrees: EARTH_AXIAL_TILT_DEGREES,
    earthBody,
    accelerationAt,
    circularOrbitVelocity,
    integrate
  });
}
