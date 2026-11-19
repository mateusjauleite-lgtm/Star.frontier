export class EntityRelations {
  #relations = new Map();

  add(sourceId, relation, targetId, metadata = {}) {
    this.#validate(sourceId, relation, targetId);
    const key = this.#key(sourceId, relation, targetId);
    if (this.#relations.has(key)) return false;
    const safeMetadata = JSON.parse(JSON.stringify(metadata));
    this.#relations.set(key, { sourceId, relation, targetId, metadata: safeMetadata });
    return true;
  }

  remove(sourceId, relation, targetId) {
    return this.#relations.delete(this.#key(sourceId, relation, targetId));
  }

  getFrom(sourceId, relation = null) {
    return [...this.#relations.values()]
      .filter(item => item.sourceId === sourceId && (relation === null || item.relation === relation))
      .map(item => ({ ...item, metadata: JSON.parse(JSON.stringify(item.metadata)) }));
  }

  getTo(targetId, relation = null) {
    return [...this.#relations.values()]
      .filter(item => item.targetId === targetId && (relation === null || item.relation === relation))
      .map(item => ({ ...item, metadata: JSON.parse(JSON.stringify(item.metadata)) }));
  }

  removeEntity(entityId) {
    let removed = 0;
    for (const [key, item] of this.#relations) {
      if (item.sourceId === entityId || item.targetId === entityId) {
        this.#relations.delete(key);
        removed++;
      }
    }
    return removed;
  }

  export() {
    return [...this.#relations.values()].map(item => ({
      ...item, metadata: JSON.parse(JSON.stringify(item.metadata))
    }));
  }

  import(items = [], { replace = false } = {}) {
    if (!Array.isArray(items)) throw new TypeError('Relações devem ser uma lista.');
    const next = replace ? new Map() : new Map(this.#relations);
    for (const item of items) {
      this.#validate(item?.sourceId, item?.relation, item?.targetId);
      const key = this.#key(item.sourceId, item.relation, item.targetId);
      next.set(key, { ...item, metadata: JSON.parse(JSON.stringify(item.metadata ?? {})) });
    }
    this.#relations = next;
    return this.#relations.size;
  }

  #key(sourceId, relation, targetId) { return JSON.stringify([sourceId, relation, targetId]); }
  #validate(sourceId, relation, targetId) {
    if (![sourceId, relation, targetId].every(value => typeof value === 'string' && value.trim())) {
      throw new TypeError('sourceId, relation e targetId devem ser textos válidos.');
    }
  }
}
