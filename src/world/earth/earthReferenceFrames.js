import * as THREE from 'three';

/**
 * Coordinates the three simulation frames:
 * globalFrame = universe/orbits; terrestrialFrame = Earth spin and surface;
 * actor-local orientation = terrain normal and tangent heading.
 */
export function createEarthReferenceFrames({ globalFrame, terrestrialFrame } = {}) {
  if (!globalFrame?.isObject3D || !terrestrialFrame?.isObject3D) {
    throw new TypeError('Earth reference frames require global and terrestrial Object3D roots.');
  }

  function attachPreservingWorld(object, parent) {
    if (!object?.isObject3D || !parent?.isObject3D) return false;
    if (object.parent !== parent) parent.attach(object);
    return true;
  }

  function setWorldPosition(object, worldPosition) {
    if (!object?.isObject3D || !worldPosition?.isVector3) return false;
    if (object.parent) {
      object.parent.updateWorldMatrix(true, false);
      object.position.copy(object.parent.worldToLocal(worldPosition.clone()));
    } else object.position.copy(worldPosition);
    object.updateMatrix();
    return true;
  }

  function setWorldQuaternion(object, worldQuaternion) {
    if (!object?.isObject3D || !worldQuaternion?.isQuaternion) return false;
    if (object.parent) {
      const parentQuaternion = object.parent.getWorldQuaternion(new THREE.Quaternion());
      object.quaternion.copy(parentQuaternion.invert().multiply(worldQuaternion));
    } else object.quaternion.copy(worldQuaternion);
    object.updateMatrix();
    return true;
  }

  function alignToSurface(object, worldNormal, preferredForward = null) {
    if (!object?.isObject3D || !worldNormal?.isVector3 || worldNormal.lengthSq() < 1e-10) return false;
    const up = worldNormal.clone().normalize();
    const currentWorldQuaternion = object.getWorldQuaternion(new THREE.Quaternion());
    const forward = preferredForward?.isVector3
      ? preferredForward.clone()
      : new THREE.Vector3(0, 0, -1).applyQuaternion(currentWorldQuaternion);
    forward.projectOnPlane(up);
    if (forward.lengthSq() < 1e-8) {
      forward.set(0, 0, -1).projectOnPlane(up);
      if (forward.lengthSq() < 1e-8) forward.set(1, 0, 0).projectOnPlane(up);
    }
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();
    const backward = new THREE.Vector3().crossVectors(right, up).normalize();
    const worldBasis = new THREE.Matrix4().makeBasis(right, up, backward);
    const worldQuaternion = new THREE.Quaternion().setFromRotationMatrix(worldBasis);
    return setWorldQuaternion(object, worldQuaternion);
  }

  function rotateAroundWorldAxis(object, worldAxis, angle) {
    if (!object?.isObject3D || !worldAxis?.isVector3 ||
        worldAxis.lengthSq() < 1e-10 || !Number.isFinite(angle)) return false;
    const worldQuaternion = object.getWorldQuaternion(new THREE.Quaternion());
    worldQuaternion.premultiply(
      new THREE.Quaternion().setFromAxisAngle(worldAxis.clone().normalize(), angle)
    );
    return setWorldQuaternion(object, worldQuaternion);
  }

  return Object.freeze({
    attachToGlobal(object) { return attachPreservingWorld(object, globalFrame); },
    attachToSurface(object) { return attachPreservingWorld(object, terrestrialFrame); },
    setWorldPosition,
    setWorldQuaternion,
    alignToSurface,
    rotateAroundWorldAxis,
    get terrestrialFrame() { return terrestrialFrame; },
    get globalFrame() { return globalFrame; }
  });
}
