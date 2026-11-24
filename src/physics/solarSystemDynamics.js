/**
 * Solar System Dynamics
 *
 * Renderer-independent N-body simulation. All translational state is SI:
 * metres, metres/second, kilograms and seconds. The Three.js layer consumes
 * immutable snapshots and is responsible only for presentation transforms.
 */
export const GRAVITATIONAL_CONSTANT_M3_KG_S2 = 6.67430e-11;
export const ASTRONOMICAL_UNIT_METERS = 149_597_870_700;
export const JULIAN_YEAR_SECONDS = 365.256363004 * 86400;
export const EARTH_MEAN_RADIUS_METERS = 6_371_008.8;

const EARTH_MASS_KG = 5.97219e24;
const SUN_MASS_KG = 1.98847e30;
const MOON_MASS_KG = 7.342e22;
const MOON_MEAN_DISTANCE_METERS = 384_400_000;
const EARTH_AXIAL_TILT_RAD = 23.439281 * Math.PI / 180;
const EARTH_SIDEREAL_ROTATION_RAD_S = 7.2921150e-5;
const TAU = Math.PI * 2;

const isVector = value =>
  Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const add = (a, b) => a.map((value, i) => value + b[i]);
const subtract = (a, b) => a.map((value, i) => value - b[i]);
const scale = (a, factor) => a.map(value => value * factor);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];
const length = value => Math.hypot(...value);
const cloneBody = body => ({
  id: body.id,
  name: body.name,
  type: body.type,
  massKg: body.massKg,
  radiusMeters: body.radiusMeters,
  positionMeters: [...body.positionMeters],
  velocityMetersPerSecond: [...body.velocityMetersPerSecond],
  rotationAxis: [...body.rotationAxis],
  angularVelocityRadPerSecond: body.angularVelocityRadPerSecond,
  rotationAngleRad: body.rotationAngleRad
});

function createInitialBodies() {
  const earthOrbitalSpeed = Math.sqrt(
    GRAVITATIONAL_CONSTANT_M3_KG_S2 * SUN_MASS_KG / ASTRONOMICAL_UNIT_METERS
  );
  const moonOrbitalSpeed = Math.sqrt(
    GRAVITATIONAL_CONSTANT_M3_KG_S2 * EARTH_MASS_KG / MOON_MEAN_DISTANCE_METERS
  );
  const earthAxis = [0, Math.cos(EARTH_AXIAL_TILT_RAD), Math.sin(EARTH_AXIAL_TILT_RAD)];

  return [
    {
      id: 'sun', name: 'Sol', type: 'star', massKg: SUN_MASS_KG,
      radiusMeters: 695_700_000,
      positionMeters: [0, 0, 0],
      velocityMetersPerSecond: [0, 0, -earthOrbitalSpeed * EARTH_MASS_KG / SUN_MASS_KG],
      rotationAxis: [0, 1, 0],
      angularVelocityRadPerSecond: 2 * Math.PI / (25.05 * 86400),
      rotationAngleRad: 0
    },
    {
      id: 'earth', name: 'Terra', type: 'planet', massKg: EARTH_MASS_KG,
      radiusMeters: EARTH_MEAN_RADIUS_METERS,
      positionMeters: [ASTRONOMICAL_UNIT_METERS, 0, 0],
      velocityMetersPerSecond: [0, 0, earthOrbitalSpeed],
      rotationAxis: earthAxis,
      angularVelocityRadPerSecond: EARTH_SIDEREAL_ROTATION_RAD_S,
      rotationAngleRad: 0
    },
    {
      id: 'moon', name: 'Lua', type: 'moon', massKg: MOON_MASS_KG,
      radiusMeters: 1_737_400,
      positionMeters: [ASTRONOMICAL_UNIT_METERS + MOON_MEAN_DISTANCE_METERS, 0, 0],
      velocityMetersPerSecond: [0, 0, earthOrbitalSpeed + moonOrbitalSpeed],
      rotationAxis: [0, 1, 0],
      angularVelocityRadPerSecond: 2 * Math.PI / (27.321661 * 86400),
      rotationAngleRad: 0
    }
  ];
}

export function createSolarSystemDynamics({
  bodies = createInitialBodies(),
  gravitationalConstant = GRAVITATIONAL_CONSTANT_M3_KG_S2,
  gravityKernel = null,
  timeScale = 1,
  maxSubstepSeconds = 60,
  maxSubstepsPerAdvance = 2048
} = {}) {
  if (!Array.isArray(bodies) || bodies.length === 0) {
    throw new TypeError('Solar System Dynamics requires at least one celestial body.');
  }
  if (!Number.isFinite(gravitationalConstant) || gravitationalConstant <= 0) {
    throw new RangeError('The gravitational constant must be positive.');
  }
  if (!Number.isFinite(timeScale) || timeScale < 0) {
    throw new RangeError('Simulation time scale must be zero or positive.');
  }
  if (!Number.isFinite(maxSubstepSeconds) || maxSubstepSeconds <= 0 ||
      !Number.isInteger(maxSubstepsPerAdvance) || maxSubstepsPerAdvance < 1) {
    throw new RangeError('Invalid integration step configuration.');
  }

  const states = new Map();
  for (const source of bodies) {
    if (!source?.id || states.has(source.id) ||
        !Number.isFinite(source.massKg) || source.massKg <= 0 ||
        !isVector(source.positionMeters) || !isVector(source.velocityMetersPerSecond)) {
      throw new TypeError('Each celestial body needs a unique id, positive mass and finite SI vectors.');
    }
    const axis = isVector(source.rotationAxis) ? source.rotationAxis : [0, 1, 0];
    const axisLength = length(axis);
    states.set(source.id, {
      id: source.id,
      name: String(source.name ?? source.id),
      type: String(source.type ?? 'body'),
      massKg: source.massKg,
      radiusMeters: Number.isFinite(source.radiusMeters) ? source.radiusMeters : 0,
      positionMeters: [...source.positionMeters],
      velocityMetersPerSecond: [...source.velocityMetersPerSecond],
      rotationAxis: axisLength > 1e-12 ? scale(axis, 1 / axisLength) : [0, 1, 0],
      angularVelocityRadPerSecond: Number.isFinite(source.angularVelocityRadPerSecond)
        ? source.angularVelocityRadPerSecond : 0,
      rotationAngleRad: Number.isFinite(source.rotationAngleRad) ? source.rotationAngleRad : 0
    });
  }

  let simulationTimeSeconds = 0;
  let currentTimeScale = timeScale;
  let paused = false;
  let accumulatedSimulationSeconds = 0;
  let integratedSubsteps = 0;

  function accelerationFor(positions) {
    if (gravityKernel?.acceleration) {
      const accelerated = positions.map((position, index) => gravityKernel.acceleration({
        position,
        bodies: orderedStates
          .filter((_, otherIndex) => otherIndex !== index)
          .map((body, filteredIndex) => {
            const otherIndex = filteredIndex >= index ? filteredIndex + 1 : filteredIndex;
            return {
              position: positions[otherIndex],
              mu: gravitationalConstant * body.massKg
            };
          })
      }));
      if (accelerated.every(isVector)) return accelerated;
    }

    // Deterministic JS fallback for tests and environments without the C++/WASM kernel.
    const acceleration = positions.map(() => [0, 0, 0]);
    for (let i = 0; i < positions.length; i += 1) {
      for (let j = i + 1; j < positions.length; j += 1) {
        const delta = subtract(positions[j], positions[i]);
        const distanceSquared = dot(delta, delta);
        if (!Number.isFinite(distanceSquared) || distanceSquared < 1) continue;
        const inverseDistanceCubed = 1 / (distanceSquared * Math.sqrt(distanceSquared));
        const factorI = gravitationalConstant * orderedStates[j].massKg * inverseDistanceCubed;
        const factorJ = gravitationalConstant * orderedStates[i].massKg * inverseDistanceCubed;
        acceleration[i] = add(acceleration[i], scale(delta, factorI));
        acceleration[j] = subtract(acceleration[j], scale(delta, factorJ));
      }
    }
    return acceleration;
  }

  let orderedStates = [...states.values()];

  function integrateStep(dt) {
    const positions = orderedStates.map(body => body.positionMeters);
    const velocities = orderedStates.map(body => body.velocityMetersPerSecond);
    const a0 = accelerationFor(positions);
    const halfVelocities = velocities.map((velocity, i) =>
      add(velocity, scale(a0[i], dt * 0.5))
    );
    const nextPositions = positions.map((position, i) =>
      add(position, scale(halfVelocities[i], dt))
    );
    const a1 = accelerationFor(nextPositions);

    orderedStates.forEach((body, i) => {
      body.positionMeters = nextPositions[i];
      body.velocityMetersPerSecond = add(halfVelocities[i], scale(a1[i], dt * 0.5));
      body.rotationAngleRad = (
        body.rotationAngleRad + body.angularVelocityRadPerSecond * dt
      ) % TAU;
    });
    simulationTimeSeconds += dt;
    integratedSubsteps += 1;
  }

  function getBodyState(id) {
    const body = states.get(id);
    return body ? Object.freeze(cloneBody(body)) : null;
  }

  function getSnapshot() {
    return Object.freeze({
      simulationTimeSeconds,
      timeScale: currentTimeScale,
      paused,
      accumulatedSimulationSeconds,
      integratedSubsteps,
      bodies: Object.freeze(orderedStates.map(body => Object.freeze(cloneBody(body))))
    });
  }

  function getReferenceFrameState(bodyId, localOffsetMeters = [0, 0, 0]) {
    const body = states.get(bodyId);
    if (!body || !isVector(localOffsetMeters)) return null;
    const axis = body.rotationAxis;
    const angle = body.rotationAngleRad;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const rotatedOffset = add(
      add(scale(localOffsetMeters, cosine), scale(cross(axis, localOffsetMeters), sine)),
      scale(axis, dot(axis, localOffsetMeters) * (1 - cosine))
    );
    const angularVelocity = scale(axis, body.angularVelocityRadPerSecond);
    return Object.freeze({
      bodyId,
      originPositionMeters: [...body.positionMeters],
      originVelocityMetersPerSecond: [...body.velocityMetersPerSecond],
      localOffsetMeters: [...localOffsetMeters],
      worldPositionMeters: add(body.positionMeters, rotatedOffset),
      worldVelocityMetersPerSecond: add(
        body.velocityMetersPerSecond,
        cross(angularVelocity, rotatedOffset)
      ),
      rotationAxis: [...axis],
      angularVelocityRadPerSecond: [...angularVelocity],
      rotationAngleRad: angle
    });
  }

  return Object.freeze({
    get timeScale() { return currentTimeScale; },
    get paused() { return paused; },
    get simulationTimeSeconds() { return simulationTimeSeconds; },
    setTimeScale(value) {
      if (!Number.isFinite(value) || value < 0) {
        throw new RangeError('Simulation time scale must be zero or positive.');
      }
      currentTimeScale = value;
      return currentTimeScale;
    },
    setPaused(value) {
      paused = Boolean(value);
      return paused;
    },
    advance(realDeltaSeconds) {
      if (!Number.isFinite(realDeltaSeconds) || realDeltaSeconds <= 0 || paused || currentTimeScale === 0) {
        return getSnapshot();
      }
      accumulatedSimulationSeconds += realDeltaSeconds * currentTimeScale;
      let steps = 0;
      while (accumulatedSimulationSeconds > 1e-9 &&
             steps < maxSubstepsPerAdvance) {
        const step = Math.min(accumulatedSimulationSeconds, maxSubstepSeconds);
        integrateStep(step);
        accumulatedSimulationSeconds -= step;
        steps += 1;
      }
      return getSnapshot();
    },
    getBodyState,
    getSnapshot,
    getReferenceFrameState,
    getBodyIds() {
      return [...states.keys()];
    }
  });
}
