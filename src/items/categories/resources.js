import { defineItem, ITEM_CATEGORIES } from '../itemDefinitions.js';
export const resourceDefinitions = Object.freeze([
  defineItem({ id: 'resource.ore.common', name: 'Minério', category: ITEM_CATEGORIES.RESOURCE, description: 'Minério bruto extraído de asteroides.', stackable: true, maxStack: 999, weight: 0.5, tags: ['resource', 'ore'] }),
  defineItem({ id: 'resource.metal.scrap', name: 'Sucata metálica', category: ITEM_CATEGORIES.RESOURCE, description: 'Material recuperado para fabricação.', stackable: true, maxStack: 999, weight: 0.3, tags: ['resource', 'crafting'] })
]);
