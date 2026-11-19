import { createEarthOrbitalFrame } from '../../../world/earth/orbitalFrame.js';

export function createOrbitalPhysicsRuntimeSystem({
  getShipFlightKernel,
  getGravityKernel,
  getEarthOrbitalFrame,
  getShipWorldPosition,
  getShipForwardWorld
} = {}) {
  if (typeof getShipFlightKernel !== 'function' ||
      typeof getGravityKernel !== 'function') {
    throw new TypeError('Os kernels de física orbital não foram fornecidos ao Runtime.');
  }

  let service = null;
  let orbitalState = null;
  let previousRelativeWorldPosition = null;

  return {
    // Sample after gameplay so telemetry reflects the ship's final transform for this frame.
    priority: 45,
    initialize(context = {}) {
      const shipFlightKernel = getShipFlightKernel();
      const gravityKernel = getGravityKernel();

      if (!shipFlightKernel ||
          typeof shipFlightKernel.gravityAcceleration !== 'function' ||
          typeof shipFlightKernel.integrateOrbitStep !== 'function' ||
          !gravityKernel ||
          typeof gravityKernel.acceleration !== 'function' ||
          typeof gravityKernel.integrateVelocity !== 'function') {
        throw new Error('Os kernels físicos não estão prontos após a inicialização do mundo.');
      }

      service = Object.freeze({
        get backend() {
          return shipFlightKernel.backend;
        },
        get gravityBackend() {
          return gravityKernel.backend;
        },
        get earthGravitationalParameter() {
          return shipFlightKernel.earthGravitationalParameter;
        },
        get state() {
          return orbitalState ? {
            ...orbitalState,
            positionMeters: [...orbitalState.positionMeters],
            velocityMetersPerSecond: orbitalState.velocityMetersPerSecond
              ? [...orbitalState.velocityMetersPerSecond]
              : null,
            gravityAccelerationMetersPerSecond2: orbitalState.gravityAccelerationMetersPerSecond2
              ? [...orbitalState.gravityAccelerationMetersPerSecond2]
              : null,
            predictedNextPositionMeters: orbitalState.predictedNextPositionMeters
              ? [...orbitalState.predictedNextPositionMeters]
              : null,
            predictedNextVelocityMetersPerSecond: orbitalState.predictedNextVelocityMetersPerSecond
              ? [...orbitalState.predictedNextVelocityMetersPerSecond]
              : null
          } : null;
        },
        gravityAcceleration(position, gravitationalParameter) {
          return shipFlightKernel.gravityAcceleration(position, gravitationalParameter);
        },
        integrateOrbitStep(position, velocity, gravitationalParameter, deltaSeconds) {
          return shipFlightKernel.integrateOrbitStep(
            position,
            velocity,
            gravitationalParameter,
            deltaSeconds
          );
        },
        acceleration(input) {
          return gravityKernel.acceleration(input);
        },
        integrateVelocity(velocity, acceleration, deltaSeconds, maximumSpeed) {
          return gravityKernel.integrateVelocity(
            velocity,
            acceleration,
            deltaSeconds,
            maximumSpeed
          );
        }
      });

      context.orbitalPhysics = service;
    },
    update(deltaSeconds, context = {}) {
      if (typeof getEarthOrbitalFrame !== 'function' ||
          typeof getShipWorldPosition !== 'function') return;
      if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;

      const earth = getEarthOrbitalFrame();
      const shipPositionWorld = getShipWorldPosition();
      const shipForwardWorld = typeof getShipForwardWorld === 'function'
        ? getShipForwardWorld()
        : null;
      if (!earth || !shipPositionWorld) return;

      try {
        const frame = createEarthOrbitalFrame(earth);
        const positionMeters = frame.worldPositionToMeters(shipPositionWorld);
        if (!positionMeters) return;

        const relativeWorldPosition = shipPositionWorld.map(
          (value, axis) => value - earth.originWorld[axis]
        );
        let velocityMetersPerSecond = null;
        if (previousRelativeWorldPosition) {
          const velocityWorld = relativeWorldPosition.map(
            (value, axis) => (value - previousRelativeWorldPosition[axis]) / deltaSeconds
          );
          velocityMetersPerSecond = frame.worldVectorToMeters(velocityWorld);
        }
        previousRelativeWorldPosition = relativeWorldPosition;

        const forwardVectorMeters = shipForwardWorld
          ? frame.worldVectorToMeters(shipForwardWorld)
          : null;
        const forwardLength = forwardVectorMeters ? Math.hypot(...forwardVectorMeters) : 0;
        const forwardDirection = forwardLength > 1e-9
          ? forwardVectorMeters.map(value => value / forwardLength)
          : null;
        const velocityLength = velocityMetersPerSecond
          ? Math.hypot(...velocityMetersPerSecond)
          : 0;
        const velocityDirectionAlignment = forwardDirection && velocityLength > 1e-6
          ? velocityMetersPerSecond.reduce(
            (sum, value, axis) => sum + (value / velocityLength) * forwardDirection[axis], 0
          )
          : null;
        const gravitationalParameter = shipFlightKernelValue(service);
        const gravityAccelerationMetersPerSecond2 = velocityMetersPerSecond
          ? service.gravityAcceleration(positionMeters, gravitationalParameter)
          : null;
        const predictedStep = velocityMetersPerSecond
          ? service.integrateOrbitStep(
            positionMeters,
            velocityMetersPerSecond,
            gravitationalParameter,
            deltaSeconds
          )
          : null;

        orbitalState = Object.freeze({
          positionMeters,
          velocityMetersPerSecond,
          gravityAccelerationMetersPerSecond2,
          predictedNextPositionMeters: predictedStep?.position ?? null,
          predictedNextVelocityMetersPerSecond: predictedStep?.velocity ?? null,
          forwardDirection,
          velocityDirectionAlignment,
          gravitationalParameterM3PerSecond2: shipFlightKernelValue(service),
          coordinateFrame: 'earth-centred-global-axes',
          positionUnit: 'm',
          velocityUnit: 'm/s',
          timeUnit: 's',
          source: 'threejs-world-transform',
          authority: 'telemetry-only',
          actuationEnabled: false,
          gravityPredictionEnabled: Boolean(predictedStep)
        });
        context.orbitalState = service.state;
      } catch {
        // A transient transform/calibration failure must not interrupt gameplay.
      }
    },
    shutdown(context = {}) {
      if (context.orbitalPhysics === service) delete context.orbitalPhysics;
      if ('orbitalState' in context) delete context.orbitalState;
      service = null;
      orbitalState = null;
      previousRelativeWorldPosition = null;
    }
  };
}

function shipFlightKernelValue(service) {
  return service?.earthGravitationalParameter ?? null;
}
