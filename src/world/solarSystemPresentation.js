/**
 * Renderer adapter for astronomical state.
 * Physics remains in SI in SolarSystemDynamics; this module only maps the
 * current observer-centred frame into Three.js coordinates.
 */
const vectorFromArray = (THREE, values) => new THREE.Vector3(values[0], values[1], values[2]);

export function createSolarSystemPresentationAdapter(THREE, {
  visualUnitsPerMeter = 1,
  anchorBodyId = 'earth',
  sunBodyId = 'sun'
} = {}) {
  if (!THREE?.Vector3 || !Number.isFinite(visualUnitsPerMeter) || visualUnitsPerMeter <= 0) {
    throw new TypeError('A Three.js namespace and positive visual scale are required.');
  }

  function getFrame(snapshot) {
    const bodies = snapshot?.bodies;
    if (!Array.isArray(bodies)) return null;
    const anchor = bodies.find(body => body.id === anchorBodyId);
    const sun = bodies.find(body => body.id === sunBodyId);
    if (!anchor || !sun) return null;

    const anchorPosition = vectorFromArray(THREE, anchor.positionMeters);
    const sunPosition = vectorFromArray(THREE, sun.positionMeters);
    const sunDirection = sunPosition.sub(anchorPosition).normalize();
    const relativePositions = {};
    for (const body of bodies) {
      relativePositions[body.id] = vectorFromArray(THREE, body.positionMeters)
        .sub(anchorPosition)
        .multiplyScalar(visualUnitsPerMeter);
    }

    return Object.freeze({
      simulationTimeSeconds: snapshot.simulationTimeSeconds,
      anchorBodyId,
      anchorPositionMeters: [...anchor.positionMeters],
      sunDirection: sunDirection.clone(),
      relativePositions: Object.freeze(relativePositions),
      earthRotationAngleRad: anchor.rotationAngleRad,
      earthRotationAxis: [...anchor.rotationAxis],
      earthVelocityMetersPerSecond: [...anchor.velocityMetersPerSecond]
    });
  }

  return Object.freeze({ getFrame });
}
