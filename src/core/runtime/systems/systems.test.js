import test from 'node:test';
import assert from 'node:assert/strict';
import { EntityManager } from '../../entities/EntityManager.js';
import { registerGameRuntimeSystems } from './registerGameRuntimeSystems.js';

function fakeRuntime() {
  const systems = [];
  return {
    systems,
    registerSystem(name, system) { systems.push({ name, ...system }); }
  };
}

function orbitalKernels() {
  const shipFlightKernel = {
    backend: 'javascript-fallback',
    earthGravitationalParameter: 3.986004418e14,
    gravityAcceleration: position => [-1, 0, 0],
    integrateOrbitStep: (position, velocity) => ({
      position: [...position],
      velocity: [...velocity]
    })
  };
  const gravityKernel = {
    backend: 'javascript-fallback',
    acceleration: () => [0, -9.8, 0],
    integrateVelocity: (velocity, acceleration) =>
      velocity.map((value, axis) => value + acceleration[axis])
  };
  return { shipFlightKernel, gravityKernel };
}

const dependencies = () => {
  const kernels = orbitalKernels();
  return {
    character: { core: { initialize() {} } },
    world: { isReady: () => true, initializeWorld() {} },
    shipComputer: { registerSystems() {}, boot() {} },
    orbitalPhysics: {
      getShipFlightKernel: () => kernels.shipFlightKernel,
      getGravityKernel: () => kernels.gravityKernel
    },
    gameplay: {
      updateEnvironment() {},
      updateCharacterMode() {},
      updateLanding() {},
      updateWorld() {},
      render() {},
      updateHud() {}
    }
  };
};

test('game runtime systems are registered in deterministic lifecycle order', () => {
  const runtime = fakeRuntime();
  registerGameRuntimeSystems(runtime, dependencies());

  assert.deepEqual(runtime.systems.map(system => system.name), [
    'entity-manager', 'character', 'world', 'ship-computer', 'gameplay', 'orbital-physics'
  ]);
  assert.deepEqual(runtime.systems.map(system => system.priority), [5, 10, 20, 30, 40, 45]);
});

test('EntityManager is exposed in runtime context and detached without losing its data', async () => {
  const runtime = fakeRuntime();
  const manager = new EntityManager({ idFactory: () => 'ship-01', eventEmitter() {} });
  const entity = manager.create({ type: 'ship', name: 'Nave exploradora' });
  registerGameRuntimeSystems(runtime, { ...dependencies(), entityManager: manager });

  const entitySystem = runtime.systems.find(system => system.name === 'entity-manager');
  const context = {};
  entitySystem.initialize(context);

  assert.equal(context.entityManager, manager);
  assert.equal(context.entityManager.get(entity.id), entity);

  entitySystem.shutdown(context);
  assert.equal('entityManager' in context, false);
  assert.equal(manager.get(entity.id), entity);
});

test('runtime creates an EntityManager when one is not injected', () => {
  const runtime = fakeRuntime();
  registerGameRuntimeSystems(runtime, dependencies());
  const entitySystem = runtime.systems.find(system => system.name === 'entity-manager');
  const context = {};

  entitySystem.initialize(context);

  assert.ok(context.entityManager instanceof EntityManager);
});

test('orbital physics service exposes the existing kernels through runtime context', () => {
  const runtime = fakeRuntime();
  const deps = dependencies();
  registerGameRuntimeSystems(runtime, deps);
  const system = runtime.systems.find(entry => entry.name === 'orbital-physics');
  const context = {};

  system.initialize(context);

  assert.equal(context.orbitalPhysics.backend, 'javascript-fallback');
  assert.equal(context.orbitalPhysics.gravityBackend, 'javascript-fallback');
  assert.equal(context.orbitalPhysics.earthGravitationalParameter, 3.986004418e14);
  assert.deepEqual(context.orbitalPhysics.gravityAcceleration([7000000, 0, 0]), [-1, 0, 0]);
  assert.deepEqual(
    context.orbitalPhysics.integrateOrbitStep([7, 0, 0], [0, 7, 0], 10, 1),
    { position: [7, 0, 0], velocity: [0, 7, 0] }
  );
  assert.deepEqual(context.orbitalPhysics.acceleration({ position: [0, 0, 0] }), [0, -9.8, 0]);
  assert.deepEqual(context.orbitalPhysics.integrateVelocity([0, 1, 0], [0, -1, 0], 1), [0, 0, 0]);

  const service = context.orbitalPhysics;
  system.shutdown(context);
  assert.equal('orbitalPhysics' in context, false);
  assert.equal(service.backend, 'javascript-fallback');
});


test('orbital runtime samples the ship in Earth-centred SI coordinates after gameplay', () => {
  const runtime = fakeRuntime();
  const deps = dependencies();
  let shipPosition = [11, 0, 0];
  registerGameRuntimeSystems(runtime, {
    ...deps,
    orbitalPhysics: {
      ...deps.orbitalPhysics,
      getEarthOrbitalFrame: () => ({
        originWorld: [10, 0, 0],
        orientationWorld: [0, 0, 0, 1],
        visualUnitsPerKm: 1
      }),
      getShipWorldPosition: () => shipPosition,
      getShipForwardWorld: () => [1, 0, 0]
    }
  });

  const system = runtime.systems.find(entry => entry.name === 'orbital-physics');
  const context = {};
  system.initialize(context);
  system.update(0.5, context);

  assert.deepEqual(context.orbitalState.positionMeters, [1000, 0, 0]);
  assert.equal(context.orbitalState.velocityMetersPerSecond, null);
  assert.equal(context.orbitalState.coordinateFrame, 'earth-centred-global-axes');
  assert.equal(context.orbitalState.authority, 'telemetry-only');
  assert.equal(context.orbitalState.actuationEnabled, false);

  shipPosition = [12, 0, 0];
  system.update(0.5, context);
  assert.deepEqual(context.orbitalState.positionMeters, [2000, 0, 0]);
  assert.deepEqual(context.orbitalState.velocityMetersPerSecond, [2000, 0, 0]);
  assert.deepEqual(context.orbitalState.forwardDirection, [1, 0, 0]);
  assert.equal(context.orbitalState.velocityDirectionAlignment, 1);
  assert.deepEqual(context.orbitalState.gravityAccelerationMetersPerSecond2, [-1, 0, 0]);
  assert.deepEqual(context.orbitalState.predictedNextPositionMeters, [2000, 0, 0]);
  assert.deepEqual(context.orbitalState.predictedNextVelocityMetersPerSecond, [2000, 0, 0]);
  assert.equal(context.orbitalState.gravityPredictionEnabled, true);
  assert.equal(context.orbitalState.actuationEnabled, false);
  assert.equal(context.orbitalPhysics.state.positionMeters[0], 2000);

  shipPosition = [11.5, 0, 0];
  system.update(0.5, context);
  assert.equal(context.orbitalState.velocityDirectionAlignment, -1);
  assert.deepEqual(context.orbitalState.predictionResidualMeters, [-500, 0, 0]);

  system.shutdown(context);
  assert.equal('orbitalState' in context, false);
});

test('orbital physics system rejects kernels that are not ready after world initialization', () => {
  const runtime = fakeRuntime();
  registerGameRuntimeSystems(runtime, {
    ...dependencies(),
    orbitalPhysics: {
      getShipFlightKernel: () => null,
      getGravityKernel: () => null
    }
  });
  const system = runtime.systems.find(entry => entry.name === 'orbital-physics');

  assert.throws(
    () => system.initialize({}),
    /kernels físicos não estão prontos/
  );
});

test('character, world and ship computer initialization is owned by runtime systems', async () => {
  const runtime = fakeRuntime();
  const calls = [];
  registerGameRuntimeSystems(runtime, {
    ...dependencies(),
    character: {
      core: {
        initialize: () => calls.push('character:init'),
        setStamina: () => calls.push('character:stamina'),
        setMode: () => calls.push('character:mode')
      },
      resetTransientState: () => calls.push('state:reset'),
      updateHUD: () => calls.push('character:hud')
    },
    world: {
      isReady: () => false,
      initializeWorld: async () => calls.push('world:init')
    },
    shipComputer: {
      registerSystems: () => calls.push('computer:register'),
      boot: () => calls.push('computer:boot')
    }
  });

  const context = {};
  for (const system of runtime.systems) await system.initialize?.(context);

  assert.ok(context.entityManager instanceof EntityManager);
  assert.ok(context.orbitalPhysics);
  assert.deepEqual(calls, [
    'state:reset',
    'character:init',
    'character:stamina',
    'character:mode',
    'character:hud',
    'world:init',
    'computer:register',
    'computer:boot'
  ]);
});

test('world system does not initialize an already-created world twice', async () => {
  const runtime = fakeRuntime();
  let calls = 0;
  registerGameRuntimeSystems(runtime, {
    ...dependencies(),
    world: { isReady: () => true, initializeWorld: () => calls++ }
  });

  await runtime.systems.find(system => system.name === 'world').initialize();
  assert.equal(calls, 0);
});
