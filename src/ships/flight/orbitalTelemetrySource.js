const valid3 = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

/**
 * Samples Three.js transforms for the Runtime. It only reads the scene:
 * SI conversion and orbital integration remain in the Runtime/Ship Core.
 */
export function createShipOrbitalTelemetrySource({ THREE, earthSystem, ship, shipVisual } = {}) {
  if (!THREE || !earthSystem?.group || !ship || !shipVisual) {
    throw new TypeError('A fonte de telemetria orbital precisa da Terra e da nave.');
  }

  return Object.freeze({
    sample() {
      const profile = earthSystem.getPlanetaryProfile?.();
      const visualUnitsPerKm = profile?.render?.visualUnitsPerKm;
      if (!Number.isFinite(visualUnitsPerKm) || visualUnitsPerKm <= 0) return null;

      earthSystem.group.updateWorldMatrix(true, false);
      ship.updateWorldMatrix(true, false);
      shipVisual.updateWorldMatrix(true, true);
      const originWorld = earthSystem.group.getWorldPosition(new THREE.Vector3()).toArray();
      const shipWorldPosition = ship.getWorldPosition(new THREE.Vector3()).toArray();
      const orientation = shipVisual.getWorldQuaternion(new THREE.Quaternion());
      const shipForwardWorld = new THREE.Vector3(0, 0, -1)
        .applyQuaternion(orientation).normalize().toArray();
      if (![originWorld, shipWorldPosition, shipForwardWorld].every(valid3)) return null;

      return {
        earthOrbitalFrame: {
          originWorld,
          // O orbital usa eixos globais inerciais; a rotação da superfície
          // continua pertencendo ao referencial terrestre.
          orientationWorld: [0, 0, 0, 1],
          metersPerVisualUnit
        },
        shipWorldPosition,
        shipForwardWorld
      };
    }
  });
}
