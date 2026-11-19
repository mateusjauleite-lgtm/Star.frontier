import test from 'node:test';
import assert from 'node:assert/strict';
import { registerGameRuntimeSystems } from './registerGameRuntimeSystems.js';

function fakeRuntime() {
  const systems = [];
  return {
    systems,
    registerSystem(name, system) { systems.push({ name, ...system }); }
  };
}

test('game runtime systems are registered in deterministic lifecycle order', () => {
  const runtime = fakeRuntime();
  registerGameRuntimeSystems(runtime, {
    character: { core: { initialize() {} } },
    world: { isReady: () => true, initializeWorld() {} },
    shipComputer: { registerSystems() {}, boot() {} },
    gameplay: { update() {} }
  });

  assert.deepEqual(runtime.systems.map(system => system.name), [
    'character', 'world', 'ship-computer', 'gameplay'
  ]);
  assert.deepEqual(runtime.systems.map(system => system.priority), [10, 20, 30, 40]);
});

test('character, world and ship computer initialization is owned by runtime systems', async () => {
  const runtime = fakeRuntime();
  const calls = [];
  registerGameRuntimeSystems(runtime, {
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
    },
    gameplay: { update() {} }
  });

  for (const system of runtime.systems) await system.initialize?.();

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
    character: { core: { initialize() {} } },
    world: { isReady: () => true, initializeWorld: () => calls++ },
    shipComputer: { registerSystems() {}, boot() {} },
    gameplay: { update() {} }
  });

  await runtime.systems.find(system => system.name === 'world').initialize();
  assert.equal(calls, 0);
});
