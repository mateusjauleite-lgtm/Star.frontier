import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrbitalPhysicsRuntimeSystem } from './orbitalPhysicsSystem.js';

function createWorld() {
  let x = 7000000;
  const kernel = {
    backend: 'javascript-fallback',
    earthGravitationalParameter: 3.986004418e14,
    gravityAcceleration(position, mu) {
      assert.equal(mu, this.earthGravitationalParameter);
      return [-8, 0, 0];
    },
    integrateOrbitStep(position, velocity, mu, dt) {
      return { position: position.map((value, axis) => value + velocity[axis] * dt), velocity: [...velocity] };
    }
  };
  const gravityKernel = {
    backend: 'javascript-fallback',
    acceleration: () => [0, 0, 0],
    integrateVelocity: velocity => [...velocity]
  };
  return {
    shipFlightKernel: kernel,
    gravityKernel,
    orbitalTelemetrySource: {
      sample() {
        const position = [x, 0, 0];
        x += 1;
        return {
          earthOrbitalFrame: { originWorld: [0, 0, 0], orientationWorld: [0, 0, 0, 1], visualUnitsPerKm: 1000 },
          shipWorldPosition: position,
          shipForwardWorld: [0, 0, -1]
        };
      }
    }
  };
}

test('orbital physics initializes from world context and exposes its service to Runtime', () => {
  const context = { world: createWorld() };
  const system = createOrbitalPhysicsRuntimeSystem();
  system.initialize(context);
  assert.equal(context.orbitalPhysics.backend, 'javascript-fallback');
  assert.equal(context.orbitalPhysics.state, null);
  system.shutdown(context);
  assert.equal(context.orbitalPhysics, undefined);
});

test('Runtime orbital update samples world transforms and publishes SI telemetry', () => {
  const context = { world: createWorld() };
  const system = createOrbitalPhysicsRuntimeSystem();
  system.initialize(context);
  system.update(0.02, context);
  assert.equal(context.orbitalState.velocityMetersPerSecond, null);
  system.update(0.02, context);
  const state = context.orbitalState;
  assert.deepEqual(state.positionMeters, [7000001, 0, 0]);
  assert.deepEqual(state.velocityMetersPerSecond, [50, 0, 0]);
  assert.deepEqual(state.gravityAccelerationMetersPerSecond2, [-8, 0, 0]);
  assert.equal(state.positionUnit, 'm');
  assert.equal(state.velocityUnit, 'm/s');
  assert.equal(state.timeUnit, 's');
  assert.equal(state.authority, 'telemetry-only');
  assert.equal(state.actuationEnabled, false);
  assert.ok(state.predictedNextPositionMeters);
  system.shutdown(context);
});

test('orbital Runtime rejects invalid or unbounded delta time without sampling', () => {
  let samples = 0;
  const world = createWorld();
  world.orbitalTelemetrySource.sample = () => { samples++; return null; };
  const context = { world };
  const system = createOrbitalPhysicsRuntimeSystem();
  system.initialize(context);
  for (const dt of [0, -1, NaN, Infinity, 0.041]) system.update(dt, context);
  assert.equal(samples, 0);
  system.shutdown(context);
});

test('orbital Runtime refuses initialization when the world has no physical kernels', () => {
  const context = { world: { orbitalTelemetrySource: { sample: () => null } } };
  const system = createOrbitalPhysicsRuntimeSystem();
  assert.throws(() => system.initialize(context), /kernels orbitais/);
});
