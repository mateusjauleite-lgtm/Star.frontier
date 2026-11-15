import {defineItem,ITEM_CATEGORIES} from '../itemDefinitions.js';
export const consumableDefinitions=Object.freeze([
 defineItem({id:'consumable.medkit.basic',code:'M-001',name:'Kit médico',category:ITEM_CATEGORIES.CONSUMABLE,description:'Recupera parte da saúde do explorador.',stackable:true,maxStack:10,weight:0.8,attributes:{heal:25},tags:['consumable','medical']}),
 defineItem({id:'consumable.oxygen.cell',code:'O-001',name:'Célula de oxigênio',category:ITEM_CATEGORIES.CONSUMABLE,description:'Reserva portátil de oxigênio.',stackable:true,maxStack:10,weight:1,attributes:{oxygen:30},tags:['consumable','oxygen']})]);
