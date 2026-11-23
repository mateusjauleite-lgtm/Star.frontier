import { MATTER_CATEGORIES } from './constants.js';
import { createMaterialRecord } from './models/materialRecord.js';
import { matterElementsCatalog } from './matterElementsDatabase.js';
const normalizeText = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function createMatterElementsCore({records=matterElementsCatalog}={}) {
 const registry=new Map();
 for(const source of records){const record=createMaterialRecord(source);if(registry.has(record.id))throw new Error(`Duplicate matter record id: ${record.id}`);registry.set(record.id,record);}
 for(const record of registry.values()){
  for(const part of record.composition){const element=registry.get(part.elementId);if(!element||element.category!==MATTER_CATEGORIES.ELEMENT)throw new Error(`Unknown chemical element "${part.elementId}" in "${record.id}"`);}
  if(record.elementId){const element=registry.get(record.elementId);if(!element||element.category!==MATTER_CATEGORIES.ELEMENT)throw new Error(`Unknown parent element "${record.elementId}" in "${record.id}"`);}
  for(const relatedId of record.relatedIds)if(!registry.has(relatedId))throw new Error(`Unknown related record "${relatedId}" in "${record.id}"`);
 }
 const get=(id)=>registry.get(id)??null;
 const list=({category,tag,state}={})=>[...registry.values()].filter(r=>(!category||r.category===category)&&(!state||r.state===state)&&(!tag||r.tags.includes(tag)));
 function search(query,{category,limit=50}={}){const needle=normalizeText(query);if(!needle)return[];return list({category}).filter(r=>normalizeText([r.id,r.name,r.symbol,r.formula,r.description,...r.tags].filter(Boolean).join(' ')).includes(needle)).slice(0,Math.max(0,limit));}
 function findByElement(elementId){const element=get(elementId);if(!element||element.category!==MATTER_CATEGORIES.ELEMENT)return[];return list().filter(r=>r.composition.some(p=>p.elementId===elementId)||r.elementId===elementId);}
 function analyzeComposition(parts){
  if(!Array.isArray(parts)||!parts.length)throw new TypeError('Composition requires at least one element fraction');
  const merged=new Map();
  for(const part of parts){const element=get(part?.elementId);if(!element||element.category!==MATTER_CATEGORIES.ELEMENT)throw new TypeError(`Unknown chemical element: ${part?.elementId}`);if(!Number.isFinite(part.fraction)||part.fraction<0)throw new TypeError('Element fractions must be non-negative finite numbers');merged.set(part.elementId,(merged.get(part.elementId)??0)+part.fraction);}
  const total=[...merged.values()].reduce((s,v)=>s+v,0);if(total<=0)throw new RangeError('Composition total must be greater than zero');
  const constituents=[...merged].map(([elementId,fraction])=>({element:get(elementId),fraction:fraction/total}));
  const keys=new Set(constituents.flatMap(({element})=>Object.entries(element.properties).filter(([,v])=>typeof v==='number').map(([k])=>k)));
  const weightedProperties={};
  for(const key of keys){const available=constituents.filter(({element})=>Number.isFinite(element.properties[key]));const weight=available.reduce((s,p)=>s+p.fraction,0);if(weight>0)weightedProperties[key]=available.reduce((s,p)=>s+p.element.properties[key]*p.fraction,0)/weight;}
  return {totalFraction:total,constituents,weightedProperties,note:'Estimativas ponderadas por fração; não substituem modelos de mistura, fases ou reações.'};
 }
 function getRelations(id){const record=get(id);if(!record)return null;const related=new Map();for(const relatedId of record.relatedIds)related.set(relatedId,get(relatedId));for(const part of record.composition)related.set(part.elementId,get(part.elementId));if(record.elementId)related.set(record.elementId,get(record.elementId));return[...related.values()].filter(Boolean);}
 return Object.freeze({get,list,search,findByElement,analyzeComposition,getRelations,get size(){return registry.size;},get categories(){return Object.values(MATTER_CATEGORIES);}});
}
export const matterElementsCore=createMatterElementsCore();