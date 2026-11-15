import { defineItem, ITEM_CATEGORIES } from '../itemDefinitions.js';
export const weaponDefinitions = Object.freeze([
  defineItem({ id: 'weapon.explorer.pistol', name: 'Pistola de exploração', category: ITEM_CATEGORIES.WEAPON, description: 'Arma lateral de defesa para exploração.', stackable: false, weight: 1.8, attributes: { slot: 'weapon', damage: 12, fireRate: 2, ammoType: 'ammo.energy.small' }, tags: ['weapon', 'ranged'] })
]);
