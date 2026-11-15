import { createItemRegistry } from './itemRegistry.js';
import { weaponDefinitions } from './categories/weapons.js';
import { toolDefinitions } from './categories/tools.js';
import { equipmentDefinitions } from './categories/equipment.js';
import { resourceDefinitions } from './categories/resources.js';
import { consumableDefinitions } from './categories/consumables.js';

export const itemDatabase = createItemRegistry([
  ...weaponDefinitions, ...toolDefinitions, ...equipmentDefinitions,
  ...resourceDefinitions, ...consumableDefinitions
]);
export const getItemDefinition = id => itemDatabase.get(id);
export const getItemDefinitionByCode = code => itemDatabase.getByCode(code);
export const getItemsByCategory = category => itemDatabase.byCategory(category);
