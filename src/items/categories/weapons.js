import { defineItem, ITEM_CATEGORIES } from '../itemDefinitions.js';

export const weaponDefinitions = Object.freeze([
  defineItem({ id: 'weapon.explorer.pistol', code: 'P-001', name: 'Pistola de exploração', category: ITEM_CATEGORIES.WEAPON, description: 'Arma lateral de defesa para exploração.', stackable: false, weight: 1.8, attributes: { slot: 'weapon', damage: 12, fireRate: 2, ammoType: 'ammo.energy.small' }, tags: ['weapon', 'ranged'] }),
  defineItem({ id: 'weapon.phaser', code: 'P-002', name: 'Phaser', category: ITEM_CATEGORIES.WEAPON, description: 'Arma de energia do explorador.', stackable: false, weight: 1.6, attributes: { slot: 'weapon', damage: 16, fireRate: 1.8, ammoType: 'ammo.energy.small' }, tags: ['weapon', 'energy'] })
]);
