import {defineItem,ITEM_CATEGORIES} from '../itemDefinitions.js';
export const toolDefinitions=Object.freeze([
 defineItem({id:'tool.mining_drill.basic',code:'B-001',name:'Broca básica',category:ITEM_CATEGORIES.TOOL,description:'Ferramenta padrão de extração.',stackable:false,weight:4,attributes:{slot:'tool',miningPower:6,durability:100},tags:['tool','mining']}),
 defineItem({id:'tool.mining_drill.reinforced',code:'B-002',name:'Broca reforçada',category:ITEM_CATEGORIES.TOOL,description:'Broca com maior capacidade de extração.',stackable:false,weight:5,attributes:{slot:'tool',miningPower:12,durability:160},tags:['tool','mining','upgrade']}),
 defineItem({id:'tool.scanner.portable',code:'S-001',name:'Scanner portátil',category:ITEM_CATEGORIES.TOOL,description:'Analisa recursos e pontos de interesse.',stackable:false,weight:1.2,attributes:{slot:'tool',scanRange:250},tags:['tool','scanner']})]);
