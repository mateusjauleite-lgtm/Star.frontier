import * as THREE from 'three';
import { MOON_PLANETARY_PROFILE, createMoonPlanetaryProfile } from './moonProfile.js';
import { createMoonSurfaceRuntime } from './moonSurface.js';

export function createMoonCore({
  earthSystem,
  visualUnitsPerMeter = 1,
  visualRadiusUnits = MOON_PLANETARY_PROFILE.physical.meanRadiusMeters
} = {}) {
  if (!earthSystem?.group?.isObject3D || !Number.isFinite(visualUnitsPerMeter) ||
      visualUnitsPerMeter <= 0) {
    throw new TypeError('Moon core requires the live Earth frame and a positive SI/render scale.');
  }

  const profile = createMoonPlanetaryProfile({ visualRadiusUnits });
  const group = new THREE.Group();
  group.name = 'StarFrontier-Moon-Core';
  group.userData.celestialBodyId = 'moon';

  const surfaceFrame = new THREE.Group();
  surfaceFrame.name = 'StarFrontier-Moon-Body-Fixed-Frame';
  group.add(surfaceFrame);

  const surfaceRuntime = createMoonSurfaceRuntime({
    surfaceFrame,
    radiusMeters: profile.physical.meanRadiusMeters,
    physicalScale: profile.physicalScale
  });

  let disposed = false;
  let lastAstronomicalState = null;

  function applyAstronomicalState(frame) {
    if (disposed || !frame?.relativePositions?.moon) return false;
    earthSystem.group.updateWorldMatrix(true, false);
    const earthCenter = earthSystem.group.getWorldPosition(new THREE.Vector3());
    const moonOffset = frame.relativePositions.moon.clone();
    group.position.copy(earthCenter.add(moonOffset));
    if (Number.isFinite(frame.moonRotationAngleRad)) {
      surfaceFrame.rotation.y = THREE.MathUtils.euclideanModulo(frame.moonRotationAngleRad, Math.PI * 2);
    }
    if (Array.isArray(frame.moonRotationAxis)) {
      const axis = new THREE.Vector3(...frame.moonRotationAxis).normalize();
      if (axis.lengthSq() > 0.5) {
        surfaceFrame.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
        surfaceFrame.rotateY(Number.isFinite(frame.moonRotationAngleRad) ? frame.moonRotationAngleRad : 0);
      }
    }
    lastAstronomicalState = frame;
    return true;
  }

  return {
    group,
    profile,
    getSurfaceFrame: () => surfaceFrame,
    getCollisionSurface: () => surfaceRuntime,
    getLocalGravityAtDistance(distanceMeters) {
      if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return null;
      return profile.physical.gravitationalParameterM3S2 / (distanceMeters * distanceMeters);
    },
    applyAstronomicalState,
    getStatus() {
      return {
        core: disposed ? 'disposed' : 'ready',
        bodyId: 'moon',
        orbitalSource: 'solar-system-n-body-dynamics',
        gravitationalParameterM3S2: profile.physical.gravitationalParameterM3S2,
        rotationFrame: 'moon-body-fixed',
        terrain: surfaceRuntime.getStatus(),
        lastAstronomicalStateAvailable: Boolean(lastAstronomicalState)
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      surfaceRuntime.dispose();
      group.remove(surfaceFrame);
    }
  };
}
