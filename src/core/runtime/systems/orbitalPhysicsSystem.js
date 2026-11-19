export function createOrbitalPhysicsRuntimeSystem({
  getShipFlightKernel,
  getGravityKernel
} = {}) {
  if (typeof getShipFlightKernel !== 'function' ||
      typeof getGravityKernel !== 'function') {
    throw new TypeError('Os kernels de física orbital não foram fornecidos ao Runtime.');
  }

  let service = null;

  return {
    priority: 35,
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
    shutdown(context = {}) {
      if (context.orbitalPhysics === service) delete context.orbitalPhysics;
      service = null;
    }
  };
}
