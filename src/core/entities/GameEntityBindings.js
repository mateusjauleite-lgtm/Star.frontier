/**
 * Connects live Three.js objects to serializable EntityManager records.
 * Scene objects intentionally stay outside Entity.metadata and snapshots.
 */
const WORLD_ENTITY_DEFINITIONS = [
  {
    id: 'planet:earth',
    type: 'planet',
    name: 'Terra',
    tags: ['world', 'planet', 'earth'],
    objectPath: 'earthSystem.group'
  },
  {
    id: 'ship:exploration',
    type: 'ship',
    name: 'Nave exploradora',
    tags: ['vehicle', 'player-ship'],
    objectPath: 'ship'
  },
  {
    id: 'character:player',
    type: 'character',
    name: 'Personagem do jogador',
    tags: ['actor', 'player'],
    objectPath: 'characterModel.group'
  },
  {
    id: 'station:orbital',
    type: 'station',
    name: 'Estação orbital',
    tags: ['structure', 'orbital'],
    objectPath: 'stationSystem.group'
  },
  {
    id: 'ship:interior',
    type: 'ship-interior',
    name: 'Interior da nave',
    tags: ['structure', 'ship-module'],
    objectPath: 'starshipInterior.group'
  },
  {
    id: 'ship:external-elevator',
    type: 'ship-module',
    name: 'Elevador externo',
    tags: ['structure', 'ship-module', 'elevator'],
    objectPath: 'externalElevator.group'
  }
];

function resolvePath(source, path) {
  return path.split('.').reduce((value, key) => value?.[key], source);
}

function ensureRelation(manager, sourceId, relation, targetId) {
  const exists = manager.relations?.getFrom?.(sourceId, relation)
    ?.some(item => item.targetId === targetId);
  if (!exists) manager.relate(sourceId, relation, targetId);
}

export function registerGameWorldEntities(manager, world = {}) {
  if (!manager ||
      typeof manager.create !== 'function' ||
      typeof manager.get !== 'function' ||
      typeof manager.update !== 'function' ||
      typeof manager.relate !== 'function') {
    throw new TypeError('Um EntityManager válido é necessário para registrar o mundo.');
  }

  const liveObjects = new Map();
  const objectIds = new WeakMap();
  const registered = [];

  for (const definition of WORLD_ENTITY_DEFINITIONS) {
    const object = resolvePath(world, definition.objectPath);
    if (!object || typeof object !== 'object') continue;

    const data = {
      type: definition.type,
      name: definition.name,
      tags: definition.tags,
      metadata: {
        runtimeBinding: true,
        objectKind: 'THREE.Object3D',
        objectPath: definition.objectPath
      }
    };

    const entity = manager.get(definition.id)
      ? manager.update(definition.id, data)
      : manager.create({ id: definition.id, ...data });

    liveObjects.set(entity.id, object);
    objectIds.set(object, entity.id);
    registered.push(entity.id);
  }

  const has = id => liveObjects.has(id);
  if (has('character:player') && has('ship:exploration')) {
    ensureRelation(manager, 'character:player', 'aboard', 'ship:exploration');
  }
  if (has('ship:exploration') && has('planet:earth')) {
    ensureRelation(manager, 'ship:exploration', 'orbits', 'planet:earth');
  }
  if (has('station:orbital') && has('planet:earth')) {
    ensureRelation(manager, 'station:orbital', 'orbits', 'planet:earth');
  }
  if (has('ship:interior') && has('ship:exploration')) {
    ensureRelation(manager, 'ship:interior', 'installed-in', 'ship:exploration');
  }
  if (has('ship:external-elevator') && has('ship:exploration')) {
    ensureRelation(manager, 'ship:external-elevator', 'attached-to', 'ship:exploration');
  }

  return Object.freeze({
    registered: [...registered],
    getObject(entityId) {
      return liveObjects.get(entityId) ?? null;
    },
    getEntityId(object) {
      return object && typeof object === 'object' ? objectIds.get(object) ?? null : null;
    },
    entries() {
      return [...liveObjects.entries()];
    }
  });
}

export { WORLD_ENTITY_DEFINITIONS };
