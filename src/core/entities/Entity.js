const VALID_STATUSES = new Set(['created', 'active', 'inactive', 'destroyed']);

function cloneSerializable(value, label) {
  try {
    const json = JSON.stringify(value);
    if (json === undefined) throw new TypeError();
    return JSON.parse(json);
  } catch {
    throw new TypeError(`${label} deve conter apenas dados serializáveis em JSON.`);
  }
}

export class Entity {
  constructor({ id, type, name = '', status = 'created', tags = [], metadata = {} } = {}) {
    if (typeof id !== 'string' || !id.trim()) throw new TypeError('A entidade precisa de um id válido.');
    if (typeof type !== 'string' || !type.trim()) throw new TypeError('A entidade precisa de um type válido.');
    if (!VALID_STATUSES.has(status)) throw new TypeError(`Status inválido: ${status}`);
    if (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string')) {
      throw new TypeError('tags deve ser uma lista de textos.');
    }
    this.id = id;
    this.type = type;
    this.name = String(name);
    this.status = status;
    this.tags = [...new Set(tags)];
    this.metadata = cloneSerializable(metadata, 'metadata');
  }

  update(patch = {}) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new TypeError('A atualização deve ser um objeto.');
    }
    if ('id' in patch && patch.id !== this.id) throw new Error('O id de uma entidade é imutável.');
    if ('type' in patch && patch.type !== this.type) throw new Error('O type de uma entidade é imutável.');
    if ('status' in patch && !VALID_STATUSES.has(patch.status)) throw new TypeError('Status inválido.');
    if ('name' in patch) this.name = String(patch.name);
    if ('status' in patch) this.status = patch.status;
    if ('tags' in patch) {
      if (!Array.isArray(patch.tags) || patch.tags.some(tag => typeof tag !== 'string')) {
        throw new TypeError('tags deve ser uma lista de textos.');
      }
      this.tags = [...new Set(patch.tags)];
    }
    if ('metadata' in patch) this.metadata = cloneSerializable(patch.metadata, 'metadata');
    return this;
  }

  toJSON() {
    return {
      id: this.id, type: this.type, name: this.name, status: this.status,
      tags: [...this.tags], metadata: cloneSerializable(this.metadata, 'metadata')
    };
  }
}

export { VALID_STATUSES };
