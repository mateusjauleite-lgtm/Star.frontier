import { createItemRegistry } from './itemRegistry.js';
import { weaponDefinitions } from './categories/weapons.js';
import { toolDefinitions } from './categories/tools.js';
import { machineDefinitions } from './categories/machines.js';
import { equipmentDefinitions } from './categories/equipment.js';
import { resourceDefinitions } from './categories/resources.js';
import { consumableDefinitions } from './categories/consumables.js';
import { defineItem, ITEM_CATEGORIES } from './itemDefinitions.js';

const legacyDefinitions = [
  defineItem({ id: 'legacy.unknown', code: 'LEGACY', name: 'Item legado', category: ITEM_CATEGORIES.RESOURCE, description: 'Item preservado de uma versão anterior do inventário.', stackable: false, weight: 0, tags: ['legacy'] })
];

export const itemDatabase = createItemRegistry([
  ...weaponDefinitions,
  ...toolDefinitions,
  ...machineDefinitions,
  ...equipmentDefinitions,
  ...resourceDefinitions,
  ...consumableDefinitions,
  ...legacyDefinitions
]);
export const getItemDefinition = id => itemDatabase.get(id);
export const getItemDefinitionByCode = code => itemDatabase.getByCode(code);
export const getItemsByCategory = category => itemDatabase.byCategory(category);
