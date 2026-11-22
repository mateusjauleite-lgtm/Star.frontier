const isVector3 = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const isQuaternion = value => Array.isArray(value) && value.length === 4 && value.every(Number.isFinite);

function rotateVector(vector, quaternion) {
  const [x, y, z] = vector;
  const [qx, qy, qz, qw] = quaternion;
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  return [
    x + qw * tx + qy * tz - qz * ty,
    y + qw * ty + qz * tx - qx * tz,
    z + qw * tz + qx * ty - qy * tx
  ];
}

function inverseQuaternion(quaternion) {
  return [-quaternion[0], -quaternion[1], -quaternion[2], quaternion[3]];
}

/**
 * Bridges Earth-centred Three.js world coordinates to SI orbital coordinates.
 * The render scale comes from Earth's planetary profile; ship mesh dimensions
 * remain a separate visual/model calibration and are not rescaled here.
 */
export function createEarthOrbitalFrame({
  originWorld = [0, 0, 0],
  orientationWorld = [0, 0, 0, 1],
  visualUnitsPerKm
} = {}) {
  if (!isVector3(originWorld) || !isQuaternion(orientationWorld) ||
      !Number.isFinite(visualUnitsPerKm) || visualUnitsPerKm <= 0) {
    throw new TypeError('Invalid Earth orbital frame calibration.');
  }

  const quaternionLength = Math.hypot(...orientationWorld);
  if (quaternionLength < 1e-9) throw new TypeError('Earth frame orientation is degenerate.');

  const orientation = orientationWorld.map(value => value / quaternionLength);
  const inverseOrientation = inverseQuaternion(orientation);
  const resolvedVisualUnitsPerKm = 1000 / resolvedMetersPerVisualUnit;
  const clean = values => values.map(value => Object.is(value, -0) ? 0 : value);

  return Object.freeze({
    originWorld: [...originWorld],
    orientationWorld: [...orientation],
    visualUnitsPerKm,
    metersPerVisualUnit,
    worldPositionToMeters(positionWorld) {
      if (!isVector3(positionWorld)) return null;
      const relative = positionWorld.map((value, axis) => value - originWorld[axis]);
      return clean(rotateVector(relative, inverseOrientation).map(value => value * resolvedMetersPerVisualUnit));
    },
    metersToWorldPosition(positionMeters) {
      if (!isVector3(positionMeters)) return null;
      const relativeWorld = rotateVector(
        positionMeters.map(value => value / resolvedMetersPerVisualUnit),
        orientation
      );
      return clean(relativeWorld.map((value, axis) => value + originWorld[axis]));
    },
    worldVectorToMeters(vectorWorld) {
      if (!isVector3(vectorWorld)) return null;
      return clean(rotateVector(vectorWorld, inverseOrientation).map(value => value * metersPerVisualUnit));
    },
    metersVectorToWorld(vectorMeters) {
      if (!isVector3(vectorMeters)) return null;
      return clean(rotateVector(
        vectorMeters.map(value => value / resolvedMetersPerVisualUnit),
        orientation
      ));
    }
  });
}
