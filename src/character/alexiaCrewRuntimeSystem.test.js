import test from 'node:test';
import assert from 'node:assert/strict';
import { createAlexiaCrewRuntimeSystem } from './alexiaCrewRuntimeSystem.js';

function makeActor() {
  const state = { movement: { x: 0, y: 0 } };
  const actor = {
    group: { position: { x: 0, y: 8.91, z: 0 }, rotation: { y: 0 } },
    core: {
      snapshot: () => ({ movement: { ...state.movement } }),
      setMovement: (x, y) => { state.movement = { x, y }; }
    },
    initialized: false,
    disposed: false,
    initialize() { this.initialized = true; },
    update() {},
    getSnapshot() { return { movement: { ...state.movement } }; },
    dispose() { this.disposed = true; }
  };
  return actor;
}

test('Runtime conecta o corpo independente da Alexia ao único núcleo de IA', () => {
  const actor = makeActor();
  let boundController = null;
  const ai = {
    bindCrewController(controller) {
      boundController = controller;
      return { accepted: true, connected: Boolean(controller) };
    }
  };
  const context = { shipComputerAI: ai };
  const runtime = createAlexiaCrewRuntimeSystem({ getActor: () => actor });
  runtime.initialize(context);

  assert.equal(actor.initialized, true);
  assert.equal(context.alexiaCrew.id, 'character:alexia');
  assert.equal(boundController, context.alexiaCrew);
  assert.equal(context.alexiaCrew.getSnapshot().status, 'online');
});

test('comandos de movimento da tripulante têm duração limitada e podem ser interrompidos', () => {
  const actor = makeActor();
  const runtime = createAlexiaCrewRuntimeSystem({ getActor: () => actor, moveSpeed: 2 });
  const context = {};
  runtime.initialize(context);

  const started = context.alexiaCrew.move({ direction: 'forward', durationSeconds: 1 });
  assert.equal(started.accepted, true);
  runtime.update(0.5);
  assert.equal(actor.group.position.z, -1);
  runtime.update(0.6);
  assert.equal(actor.group.position.z, -2);
  assert.deepEqual(actor.core.snapshot().movement, { x: 0, y: 0 });
  assert.equal(context.alexiaCrew.getSnapshot().moving, false);

  context.alexiaCrew.move({ direction: 'right', durationSeconds: 3 });
  context.alexiaCrew.stop();
  runtime.update(0.5);
  assert.equal(actor.group.position.x, 0);
});

test('desligamento libera o vínculo com a IA e o estado do ator', () => {
  const actor = makeActor();
  let boundController = null;
  const runtime = createAlexiaCrewRuntimeSystem({
    getActor: () => actor
  });
  const context = {
    shipComputerAI: {
      bindCrewController(controller) { boundController = controller; }
    }
  };
  runtime.initialize(context);
  runtime.shutdown(context);

  assert.equal(boundController, null);
  assert.equal(actor.disposed, true);
  assert.equal('alexiaCrew' in context, false);
});
