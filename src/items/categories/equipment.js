import {defineItem,ITEM_CATEGORIES} from '../itemDefinitions.js';
export const equipmentDefinitions=Object.freeze([
 defineItem({id:'equipment.suit.explorer.basic',code:'T-001',name:'Traje de exploração básico',category:ITEM_CATEGORIES.EQUIPMENT,description:'Traje padrão do explorador.',stackable:false,weight:8,attributes:{slot:'suit',protection:5},tags:['equipment','suit']}),
 defineItem({id:'equipment.helmet.explorer.basic',code:'C-001',name:'Capacete básico',category:ITEM_CATEGORIES.EQUIPMENT,description:'Capacete pressurizado.',stackable:false,weight:2,attributes:{slot:'helmet',protection:2},tags:['equipment','helmet']})]);
