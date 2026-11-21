import test from 'node:test';
import assert from 'node:assert/strict';
import { EntityManager } from './EntityManager.js';
import { registerGameWorldEntities } from './GameEntityBindings.js';

function object3D(name) {
  return { name, isObject3D: true, children: [] };
}

test('registers live world objects as stable entities without serializing Three.js objects', () => {
  const manager = new EntityManager({ idFactory: () => 'generated', eventEmitter: () => {} });
  const world = {
    earthSystem: { group: object3D('earth') },
    ship: object3D('ship'),
    characterModel: { group: object3D('player') },
    stationSystem: { group: object3D('station') },
    starshipInterior: { group: object3D('interior') },
    externalElevator: { group: object3D('elevator') }
  };

  const bindings = registerGameWorldEntities(manager, world);
  assert.equal(manager.list().length, 7);
  assert.equal(manager.get('resource:ore-dilithium').type, 'resource');
  assert.equal(bindings.getObject('ship:exploration'), world.ship);
  assert.equal(bindings.getEntityId(world.characterModel.group), 'character:player');
  assert.equal(manager.get('ship:exploration').metadata.objectKind, 'THREE.Object3D');
  assert.doesNotThrow(() => JSON.stringify(manager.exportSnapshot()));
  assert.equal(JSON.stringify(manager.exportSnapshot()).includes('"children"'), false);
});

test('creates semantic relationships between registered world entities', () => {
  const manager = new EntityManager({ idFactory: () => 'generated', eventEmitter: () => {} });
  const world = {
    earthSystem: { group: object3D('earth') },
    ship: object3D('ship'),
    characterModel: { group: object3D('player') },
    stationSystem: { group: object3D('station') },
    starshipInterior: { group: object3D('interior') },
    externalElevator: { group: object3D('elevator') }
  };

  registerGameWorldEntities(manager, world);
  assert.equal(manager.relations.getFrom('character:player', 'aboard')[0].targetId, 'ship:exploration');
  assert.equal(manager.relations.getFrom('ship:exploration', 'orbits')[0].targetId, 'planet:earth');
  assert.equal(manager.relations.getFrom('station:orbital', 'orbits')[0].targetId, 'planet:earth');
  assert.equal(manager.relations.getFrom('ship:interior', 'installed-in')[0].targetId, 'ship:exploration');
  assert.equal(manager.relations.getFrom('ship:external-elevator', 'attached-to')[0].targetId, 'ship:exploration');
});

test('registration is idempotent and refreshes live object bindings', () => {
  const manager = new EntityManager({ idFactory: () => 'generated', eventEmitter: () => {} });
  const firstShip = object3D('ship-1');
  const secondShip = object3D('ship-2');

  registerGameWorldEntities(manager, { ship: firstShip });
  const bindings = registerGameWorldEntities(manager, { ship: secondShip });

  assert.equal(manager.list({ type: 'ship' }).length, 1);
  assert.equal(bindings.getObject('ship:exploration'), secondShip);
  assert.equal(manager.relations.getFrom('ship:exploration', 'orbits').length, 0);
});
