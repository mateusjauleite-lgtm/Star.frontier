import { defineItem, ITEM_CATEGORIES } from '../itemDefinitions.js';

export const machineDefinitions = Object.freeze([
  defineItem({ id: 'machine.portable.fabricator', code: 'MCH-01', name: 'Fabricador portátil', category: ITEM_CATEGORIES.MACHINE, description: 'Máquina compacta para fabricação de componentes.', stackable: false, weight: 6, attributes: { slot: 'machine', durability: 100, fabricationTier: 1 }, tags: ['machine', 'fabrication'] })
]);
