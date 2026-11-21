import { createOrbitalFlightAuthority } from '../../../ships/flight/orbitalFlightAuthority.js';
import { createEarthOrbitalFrame } from '../../../world/earth/orbitalFrame.js';

export function createOrbitalPhysicsRuntimeSystem(dependencies = {}) {
  const { getShipFlightKernel, getGravityKernel, getEarthOrbitalFrame, getShipWorldPosition, getShipForwardWorld } = dependencies;
  let telemetrySource = null;
  let service = null;
  let orbitalState = null;
  let previousRelativeWorldPosition = null;
  let previousPredictedPositionMeters = null;
  const controlAuthority = createOrbitalFlightAuthority();

  return {
    // A gameplay termina os movimentos manuais e colisões antes da amostragem.
    priority: 45,
    initialize(context = {}) {
      const world = context.world;
      const shipFlightKernel = world?.shipFlightKernel ?? getShipFlightKernel?.();
      const gravityKernel = world?.gravityKernel ?? getGravityKernel?.();
      telemetrySource = world?.orbitalTelemetrySource ?? {
        sample() {
          const earthOrbitalFrame = getEarthOrbitalFrame?.();
          const shipWorldPosition = getShipWorldPosition?.();
          if (!earthOrbitalFrame || !shipWorldPosition) return null;
          return { earthOrbitalFrame, shipWorldPosition, shipForwardWorld: getShipForwardWorld?.() ?? null };
        }
      };
      if (!telemetrySource ||
          typeof telemetrySource.sample !== 'function' ||
          !shipFlightKernel ||
          typeof shipFlightKernel.gravityAcceleration !== 'function' ||
          typeof shipFlightKernel.integrateOrbitStep !== 'function' ||
          !gravityKernel ||
          typeof gravityKernel.acceleration !== 'function' ||
          typeof gravityKernel.integrateVelocity !== 'function') {
        throw new Error('Os kernels orbitais físicos não estão prontos após a inicialização do mundo.');
      }

      service = Object.freeze({
        get backend() { return shipFlightKernel.backend; },
        get gravityBackend() { return gravityKernel.backend; },
        get earthGravitationalParameter() { return shipFlightKernel.earthGravitationalParameter; },
        get controlAuthority() { return controlAuthority.snapshot(); },
        calibrateControlAuthority(calibration) { return controlAuthority.calibrate(calibration); },
        setControlProposalEnabled(enabled, blend) { return controlAuthority.setProposalEnabled(enabled, blend); },
        proposeControlCorrection(input) { return controlAuthority.proposeCorrection(input); },
        get state() {
          if (!orbitalState) return null;
          return {
            ...orbitalState,
            positionMeters: [...orbitalState.positionMeters],
            velocityMetersPerSecond: orbitalState.velocityMetersPerSecond
              ? [...orbitalState.velocityMetersPerSecond] : null,
            gravityAccelerationMetersPerSecond2: orbitalState.gravityAccelerationMetersPerSecond2
              ? [...orbitalState.gravityAccelerationMetersPerSecond2] : null,
            predictedNextPositionMeters: orbitalState.predictedNextPositionMeters
              ? [...orbitalState.predictedNextPositionMeters] : null,
            predictedNextVelocityMetersPerSecond: orbitalState.predictedNextVelocityMetersPerSecond
              ? [...orbitalState.predictedNextVelocityMetersPerSecond] : null,
            predictionResidualMeters: orbitalState.predictionResidualMeters
              ? [...orbitalState.predictionResidualMeters] : null,
            controlAuthority: controlAuthority.snapshot()
          };
        },
        gravityAcceleration(position, mu) { return shipFlightKernel.gravityAcceleration(position, mu); },
        integrateOrbitStep(position, velocity, mu, dt) {
          return shipFlightKernel.integrateOrbitStep(position, velocity, mu, dt);
        },
        acceleration(input) { return gravityKernel.acceleration(input); },
        integrateVelocity(velocity, acceleration, dt, maximumSpeed) {
          return gravityKernel.integrateVelocity(velocity, acceleration, dt, maximumSpeed);
        }
      });
      context.orbitalPhysics = service;
    },
    update(deltaSeconds, context = {}) {
      if (!service || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
      const sample = telemetrySource?.sample?.();
      if (!sample?.earthOrbitalFrame || !sample.shipWorldPosition) return;

      try {
        const frame = createEarthOrbitalFrame(sample.earthOrbitalFrame);
        const positionMeters = frame.worldPositionToMeters(sample.shipWorldPosition);
        if (!positionMeters) return;

        const relativeWorldPosition = sample.shipWorldPosition.map(
          (value, axis) => value - sample.earthOrbitalFrame.originWorld[axis]
        );
        let velocityMetersPerSecond = null;
        if (previousRelativeWorldPosition) {
          const velocityWorld = relativeWorldPosition.map(
            (value, axis) => (value - previousRelativeWorldPosition[axis]) / deltaSeconds
          );
          velocityMetersPerSecond = frame.worldVectorToMeters(velocityWorld);
        }
        previousRelativeWorldPosition = relativeWorldPosition;

        const forwardVectorMeters = sample.shipForwardWorld
          ? frame.worldVectorToMeters(sample.shipForwardWorld) : null;
        const forwardLength = forwardVectorMeters ? Math.hypot(...forwardVectorMeters) : 0;
        const forwardDirection = forwardLength > 1e-9
          ? forwardVectorMeters.map(value => value / forwardLength) : null;
        const velocityLength = velocityMetersPerSecond ? Math.hypot(...velocityMetersPerSecond) : 0;
        const velocityDirectionAlignment = forwardDirection && velocityLength > 1e-6
          ? velocityMetersPerSecond.reduce(
            (sum, value, axis) => sum + (value / velocityLength) * forwardDirection[axis], 0
          ) : null;

        const mu = service.earthGravitationalParameter;
        const gravityAccelerationMetersPerSecond2 = velocityMetersPerSecond
          ? service.gravityAcceleration(positionMeters, mu) : null;
        const predictionResidualMeters = previousPredictedPositionMeters
          ? positionMeters.map((value, axis) => value - previousPredictedPositionMeters[axis]) : null;
        const predictedStep = velocityMetersPerSecond
          ? service.integrateOrbitStep(positionMeters, velocityMetersPerSecond, mu, deltaSeconds) : null;
        previousPredictedPositionMeters = predictedStep?.position
          ? [...predictedStep.position] : null;

        orbitalState = Object.freeze({
          positionMeters,
          velocityMetersPerSecond,
          gravityAccelerationMetersPerSecond2,
          predictedNextPositionMeters: predictedStep?.position ?? null,
          predictedNextVelocityMetersPerSecond: predictedStep?.velocity ?? null,
          predictionResidualMeters,
          forwardDirection,
          velocityDirectionAlignment,
          gravitationalParameterM3PerSecond2: mu,
          coordinateFrame: 'earth-centred-global-axes',
          positionUnit: 'm',
          velocityUnit: 'm/s',
          timeUnit: 's',
          source: 'threejs-world-transform',
          authority: 'telemetry-only',
          actuationEnabled: false,
          controlAuthority: controlAuthority.snapshot(),
          gravityPredictionEnabled: Boolean(predictedStep)
        });
        context.orbitalState = service.state;
      } catch {
        // Uma falha transitória de transformação não interrompe a gameplay.
      }
    },
    shutdown(context = {}) {
      if (context.orbitalPhysics === service) delete context.orbitalPhysics;
      if ('orbitalState' in context) delete context.orbitalState;
      service = null;
      telemetrySource = null;
      orbitalState = null;
      previousRelativeWorldPosition = null;
      previousPredictedPositionMeters = null;
      controlAuthority.setProposalEnabled(false);
      controlAuthority.calibrate({});
    }
  };
}
