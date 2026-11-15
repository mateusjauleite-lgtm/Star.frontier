// Definições estáticas: descrevem o tipo do item, não uma unidade possuída.
export const ITEM_CATEGORIES = Object.freeze({
  WEAPON: 'weapon', TOOL: 'tool', EQUIPMENT: 'equipment',
  RESOURCE: 'resource', CONSUMABLE: 'consumable'
});

export function defineItem(definition) {
  if (!definition || typeof definition !== 'object') throw new TypeError('Definição de item inválida.');
  const item = {
    id: definition.id,
    name: definition.name,
    category: definition.category,
    description: definition.description ?? '',
    icon: definition.icon ?? null,
    stackable: definition.stackable ?? false,
    maxStack: definition.stackable ? (definition.maxStack ?? 99) : 1,
    weight: definition.weight ?? 0,
    rarity: definition.rarity ?? 'common',
    attributes: Object.freeze({ ...(definition.attributes ?? {}) }),
    tags: Object.freeze([...(definition.tags ?? [])])
  };
  return Object.freeze(item);
}
