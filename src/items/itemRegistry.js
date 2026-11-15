import { validateItemDefinition } from './itemValidation.js';
export function createItemRegistry(definitions = []) {
  const items = new Map();
  for (const definition of definitions) {
    const errors = validateItemDefinition(definition);
    if (errors.length) throw new TypeError(errors.join(' '));
    if (items.has(definition.id)) throw new Error(`ID de item duplicado: ${definition.id}`);
    items.set(definition.id, Object.freeze(definition));
  }
  return Object.freeze({
    get: id => items.get(id) ?? null,
    has: id => items.has(id),
    all: () => [...items.values()],
    byCategory: category => [...items.values()].filter(item => item.category === category),
    ids: () => [...items.keys()]
  });
}
