import { emit } from '../events.js';
import { Entity } from './Entity.js';
import { EntityRegistry } from './EntityRegistry.js';
import { EntityRelations } from './EntityRelations.js';
import { EntityLifecycle } from './EntityLifecycle.js';

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `entity-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export class EntityManager {
  constructor({ registry = new EntityRegistry(), relations = new EntityRelations(), lifecycle = new EntityLifecycle(), eventEmitter = emit, idFactory = createId } = {}) {
    this.registry = registry;
    this.relations = relations;
    this.lifecycle = lifecycle;
    this.eventEmitter = eventEmitter;
    this.idFactory = idFactory;
  }

  create(data = {}) {
    const entity = new Entity({ ...data, id: data.id ?? this.idFactory() });
    return this.register(entity);
  }

  register(entity) {
    if (!(entity instanceof Entity)) {
      throw new TypeError('O registro exige uma instância válida de Entity.');
    }
    this.registry.register(entity);
    this.#emit('entity:created', { entity: entity.toJSON() });
    return entity;
  }

  get(id) { return this.registry.get(id); }
  has(id) { return this.registry.has(id); }

  list({ type = null, status = null, tag = null } = {}) {
    return this.registry.values().filter(entity =>
      (type === null || entity.type === type) &&
      (status === null || entity.status === status) &&
      (tag === null || entity.tags.includes(tag))
    );
  }

  update(id, patch) {
    const entity = this.#require(id);
    const before = entity.toJSON();
    entity.update(patch);
    this.#emit('entity:updated', { entity: entity.toJSON(), previous: before });
    return entity;
  }

  activate(id) { return this.#transition(id, 'activate'); }
  deactivate(id) { return this.#transition(id, 'deactivate'); }
  destroy(id) { return this.#transition(id, 'destroy'); }

  remove(id) {
    const entity = this.registry.remove(id);
    if (!entity) return false;
    this.relations.removeEntity(id);
    this.#emit('entity:removed', { entity: entity.toJSON() });
    return true;
  }

  relate(sourceId, relation, targetId, metadata = {}) {
    this.#require(sourceId);
    this.#require(targetId);
    const created = this.relations.add(sourceId, relation, targetId, metadata);
    if (created) this.#emit('entity:related', { sourceId, relation, targetId });
    return created;
  }

  unrelate(sourceId, relation, targetId) {
    const removed = this.relations.remove(sourceId, relation, targetId);
    if (removed) this.#emit('entity:unrelated', { sourceId, relation, targetId });
    return removed;
  }

  exportSnapshot() {
    return {
      version: 1,
      entities: this.registry.values().map(entity => entity.toJSON()),
      relations: this.relations.export()
    };
  }

  importSnapshot(snapshot, { replace = false } = {}) {
    if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.entities) || !Array.isArray(snapshot.relations)) {
      throw new TypeError('Snapshot de entidades inválido ou incompatível.');
    }
    const entities = snapshot.entities.map(data => new Entity(data));
    const ids = new Set(entities.map(entity => entity.id));
    if (ids.size !== entities.length) throw new Error('Snapshot contém ids de entidade duplicados.');
    if (!replace && entities.some(entity => this.has(entity.id))) {
      throw new Error('Snapshot contém ids que já estão registrados.');
    }

    // Validate and stage every relation before mutating the live registry.
    // A malformed relation must never leave a replace import half-applied.
    const stagedRelations = new EntityRelations();
    if (!replace) stagedRelations.import(this.relations.export(), { replace: true });
    stagedRelations.import(snapshot.relations);
    const nextRelations = stagedRelations.export();

    for (const relation of nextRelations) {
      if (!ids.has(relation.sourceId) && !( !replace && this.has(relation.sourceId))) {
        throw new Error(`Relação aponta para entidade inexistente: ${relation.sourceId}`);
      }
      if (!ids.has(relation.targetId) && !( !replace && this.has(relation.targetId))) {
        throw new Error(`Relação aponta para entidade inexistente: ${relation.targetId}`);
      }
    }

    if (replace) this.registry.clear();
    for (const entity of entities) this.registry.register(entity);
    this.relations.import(nextRelations, { replace: true });
    this.#emit('entity:snapshot-imported', { count: entities.length });
    return entities.length;
  }

  #transition(id, action) {
    const entity = this.#require(id);
    const result = this.lifecycle[action](entity);
    this.#emit('entity:status-changed', {
      entity: entity.toJSON(), previousStatus: result.previousStatus, status: result.status
    });
    return entity;
  }

  #require(id) {
    const entity = this.get(id);
    if (!entity) throw new Error(`Entidade não encontrada: ${id}`);
    return entity;
  }

  #emit(name, payload) {
    this.eventEmitter(name, payload);
  }
}

export default EntityManager;
