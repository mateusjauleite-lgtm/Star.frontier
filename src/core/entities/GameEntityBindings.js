import { RESOURCE_IDS, createResourceEntityData } from '../resources/resourceCatalog.js';
import { DILITHIUM_COMPONENT_IDS } from '../../ships/engineering/dilithiumProcessingSystem.js';

/**
 * Connects live Three.js objects to serializable EntityManager records.
 * Scene objects intentionally stay outside Entity.metadata and snapshots.
 */
const WORLD_ENTITY_DEFINITIONS = [
  { id: 'planet:earth', type: 'planet', name: 'Terra', tags: ['world', 'planet', 'earth'], objectPath: 'earthSystem.group' },
  { id: 'ship:exploration', type: 'ship', name: 'Nave exploradora', tags: ['vehicle', 'player-ship'], objectPath: 'ship' },
  { id: 'character:player', type: 'character', name: 'Personagem do jogador', tags: ['actor', 'player'], objectPath: 'characterModel.group' },
  { id: 'station:orbital', type: 'station', name: 'Estação orbital', tags: ['structure', 'orbital'], objectPath: 'stationSystem.group' },
  { id: 'ship:interior', type: 'ship-interior', name: 'Interior da nave', tags: ['structure', 'ship-module'], objectPath: 'starshipInterior.group' },
  { id: 'ship:external-elevator', type: 'ship-module', name: 'Elevador externo', tags: ['structure', 'ship-module', 'elevator'], objectPath: 'externalElevator.group' }
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
  if (!manager || typeof manager.create !== 'function' || typeof manager.get !== 'function' ||
      typeof manager.update !== 'function' || typeof manager.relate !== 'function') {
    throw new TypeError('Um EntityManager válido é necessário para registrar o mundo.');
  }

  const liveObjects = new Map();
  const objectIds = new WeakMap();
  const registered = [];
  const register = (id, data, object = null) => {
    const entity = manager.get(id) ? manager.update(id, data) : manager.create({ id, ...data });
    registered.push(entity.id);
    if (object) {
      liveObjects.set(entity.id, object);
      objectIds.set(object, entity.id);
    }
    return entity;
  };

  for (const definition of WORLD_ENTITY_DEFINITIONS) {
    const object = resolvePath(world, definition.objectPath);
    if (!object || typeof object !== 'object') continue;
    register(definition.id, {
      type: definition.type, name: definition.name, tags: definition.tags,
      metadata: { runtimeBinding: true, objectKind: 'THREE.Object3D', objectPath: definition.objectPath }
    }, object);
  }

  // O minério é uma entidade de recurso independente, compartilhada por todos os depósitos.
  register(RESOURCE_IDS.DILITHIUM_ORE, createResourceEntityData(RESOURCE_IDS.DILITHIUM_ORE));
  const asteroidSystem = world.asteroidSystem;
  for (const asteroid of asteroidSystem?.asteroids ?? []) {
    const id = asteroid.userData?.entityId;
    if (!id) continue;
    const deposits = Object.entries(asteroid.userData.resources ?? {})
      .filter(([, deposit]) => Number(deposit?.amount) > 0)
      .map(([resourceId, deposit]) => ({ resourceId, amount: deposit.amount, purity: deposit.purity ?? null }));
    register(id, {
      type: 'asteroid', name: 'Asteroide de mineração',
      tags: ['world-object', 'asteroid', ...(deposits.length ? ['resource-bearing'] : [])],
      metadata: {
        runtimeBinding: true, objectKind: 'THREE.Mesh', objectPath: 'asteroidSystem.asteroids',
        radius: asteroid.userData.radius, deposits
      }
    }, asteroid);
    for (const deposit of deposits) ensureRelation(manager, id, 'contains-resource', deposit.resourceId);
  }

  const interior = world.starshipInterior;
  const componentDefinitions = [
    [DILITHIUM_COMPONENT_IDS.WARP_CORE, 'warp-core', 'Núcleo de dobra', interior?.warpCore],
    [DILITHIUM_COMPONENT_IDS.RAW_STORAGE, 'resource-storage', 'Armazenamento de dilítio bruto', interior?.dilithiumPlant?.userData?.components?.rawStorage],
    [DILITHIUM_COMPONENT_IDS.REFINERY, 'processing-machine', 'Refinador de dilítio', interior?.dilithiumPlant?.userData?.components?.refinery],
    [DILITHIUM_COMPONENT_IDS.REFINED_STORAGE, 'resource-storage', 'Armazenamento de dilítio refinado', interior?.dilithiumPlant?.userData?.components?.refinedStorage]
  ];
  for (const [id, type, name, object] of componentDefinitions) {
    if (!object) continue;
    register(id, { type, name, tags: ['ship-system', 'engineering', 'dilithium'], metadata: { runtimeBinding: true, objectKind: 'THREE.Group', deck: 3, recognitionPriority: [DILITHIUM_COMPONENT_IDS.WARP_CORE, DILITHIUM_COMPONENT_IDS.REFINERY, DILITHIUM_COMPONENT_IDS.REFINED_STORAGE, DILITHIUM_COMPONENT_IDS.RAW_STORAGE].indexOf(id) } }, object);
    if (manager.get('ship:interior')) ensureRelation(manager, id, 'installed-in', 'ship:interior');
  }
  if (manager.get(DILITHIUM_COMPONENT_IDS.RAW_STORAGE)) ensureRelation(manager, DILITHIUM_COMPONENT_IDS.RAW_STORAGE, 'stores-resource', RESOURCE_IDS.DILITHIUM_ORE);
  if (manager.get(DILITHIUM_COMPONENT_IDS.REFINERY)) {
    ensureRelation(manager, DILITHIUM_COMPONENT_IDS.REFINERY, 'processes-resource', RESOURCE_IDS.DILITHIUM_ORE);
    ensureRelation(manager, DILITHIUM_COMPONENT_IDS.REFINERY, 'produces-resource', RESOURCE_IDS.REFINED_DILITHIUM);
  }
  if (manager.get(DILITHIUM_COMPONENT_IDS.REFINED_STORAGE)) {
    ensureRelation(manager, DILITHIUM_COMPONENT_IDS.REFINED_STORAGE, 'stores-resource', RESOURCE_IDS.REFINED_DILITHIUM);
    ensureRelation(manager, DILITHIUM_COMPONENT_IDS.REFINED_STORAGE, 'feeds-system', DILITHIUM_COMPONENT_IDS.WARP_CORE);
  }
  if (manager.get(DILITHIUM_COMPONENT_IDS.WARP_CORE)) ensureRelation(manager, DILITHIUM_COMPONENT_IDS.WARP_CORE, 'consumes-resource', RESOURCE_IDS.REFINED_DILITHIUM);

  const has = id => liveObjects.has(id);
  if (has('character:player') && has('ship:exploration')) ensureRelation(manager, 'character:player', 'aboard', 'ship:exploration');
  if (has('ship:exploration') && has('planet:earth')) ensureRelation(manager, 'ship:exploration', 'orbits', 'planet:earth');
  if (has('station:orbital') && has('planet:earth')) ensureRelation(manager, 'station:orbital', 'orbits', 'planet:earth');
  if (has('ship:interior') && has('ship:exploration')) ensureRelation(manager, 'ship:interior', 'installed-in', 'ship:exploration');
  if (has('ship:external-elevator') && has('ship:exploration')) ensureRelation(manager, 'ship:external-elevator', 'attached-to', 'ship:exploration');

  return Object.freeze({
    registered: [...registered],
    getObject(entityId) { return liveObjects.get(entityId) ?? null; },
    getEntityId(object) { return object && typeof object === 'object' ? objectIds.get(object) ?? null : null; },
    entries() { return [...liveObjects.entries()]; }
  });
}

export { WORLD_ENTITY_DEFINITIONS };
