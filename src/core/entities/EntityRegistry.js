export class EntityRegistry {
  #entities = new Map();

  register(entity) {
    if (!entity || typeof entity.id !== 'string' || !entity.id.trim()) {
      throw new TypeError('Entidade inválida.');
    }
    if (this.#entities.has(entity.id)) throw new Error(`Já existe uma entidade com id "${entity.id}".`);
    this.#entities.set(entity.id, entity);
    return entity;
  }

  get(id) { return this.#entities.get(id) ?? null; }
  has(id) { return this.#entities.has(id); }
  remove(id) {
    const entity = this.get(id);
    if (!entity) return null;
    this.#entities.delete(id);
    return entity;
  }
  values() { return [...this.#entities.values()]; }
  get size() { return this.#entities.size; }
  clear() { this.#entities.clear(); }
}
