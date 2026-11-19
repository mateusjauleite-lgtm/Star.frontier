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

const dependencies = () => ({
  character: { core: { initialize() {} } },
  world: { isReady: () => true, initializeWorld() {} },
  shipComputer: { registerSystems() {}, boot() {} },
  gameplay: { update() {} }
});

test('game runtime systems are registered in deterministic lifecycle order', () => {
  const runtime = fakeRuntime();
  registerGameRuntimeSystems(runtime, dependencies());

  assert.deepEqual(runtime.systems.map(system => system.name), [
    'entity-manager', 'character', 'world', 'ship-computer', 'gameplay'
  ]);
  assert.deepEqual(runtime.systems.map(system => system.priority), [5, 10, 20, 30, 40]);
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
