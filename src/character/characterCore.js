import { emit } from '../core/events.js';
import { createInventory } from '../items/inventory/inventoryCore.js';
const EQUIPMENT_SLOTS=Object.freeze(['weapon','tool','machine','suit','helmet','torso','gloves','legs','boots']);
const DEFAULT_CHARACTER_STATE={initialized:false,mode:'on-foot',posture:'standing',health:100,stamina:100,grounded:true,movement:{x:0,y:0},look:{x:0,y:0},interactionTarget:null,equipment:Object.fromEntries(EQUIPMENT_SLOTS.map(slot=>[slot,null]))};
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));const copyItem=i=>i?{...i,metadata:{...(i.metadata||{})}}:null;
function copyState(s){return{...s,movement:{...s.movement},look:{...s.look},equipment:Object.fromEntries(EQUIPMENT_SLOTS.map(k=>[k,copyItem(s.equipment?.[k])]))};}
export function createCharacterCore(initialState={},options={}){
 const saved=options.inventorySnapshot;const state={...DEFAULT_CHARACTER_STATE,...initialState,movement:{...DEFAULT_CHARACTER_STATE.movement,...(initialState.movement||{})},look:{...DEFAULT_CHARACTER_STATE.look,...(initialState.look||{})},equipment:{...DEFAULT_CHARACTER_STATE.equipment,...(saved?.equipment||{}),...(initialState.equipment||{})}};
 const inventory=options.itemRegistry?createInventory({registry:options.itemRegistry,capacity:saved?.capacity??options.inventoryCapacity??24,maxWeight:saved?.maxWeight??options.inventoryMaxWeight??60,items:Array.isArray(saved?.items)?saved.items:[]}):null;
 for(const slot of EQUIPMENT_SLOTS){const item=state.equipment[slot],def=item&&options.itemRegistry?.get(item.definitionId);if(item&&(!def||def.attributes?.slot!==slot))state.equipment[slot]=null;}
 function getInventorySnapshot(){const data=inventory?.snapshot()??null;return data?{...data,equipment:copyState(state).equipment}:null;}
 function snapshot(){return{...copyState(state),inventory:getInventorySnapshot()};}
 function publish(name){const value=snapshot();emit(name,value);emit('character:updated',value);}
 function initialize(){if(state.initialized)return snapshot();state.initialized=true;publish('character:initialized');return snapshot();}
 function setMode(mode){if(!['on-foot','ship-control'].includes(mode))throw new TypeError('Modo do personagem inválido.');state.mode=mode;state.posture=mode==='ship-control'?'seated':'standing';state.movement={x:0,y:0};publish('character:mode-changed');return snapshot();}
 function setMovement(x,y){if(state.mode!=='on-foot'||!Number.isFinite(x)||!Number.isFinite(y))return snapshot();state.movement={x:clamp(x,-1,1),y:clamp(y,-1,1)};publish('character:movement-changed');return snapshot();}
 function setLook(x,y){if(state.mode!=='on-foot'||!Number.isFinite(x)||!Number.isFinite(y))return snapshot();state.look={x,y};publish('character:look-changed');return snapshot();}
 function setGrounded(v){state.grounded=Boolean(v);publish('character:grounded-changed');return snapshot();}
 function setHealth(v){if(!Number.isFinite(v))return snapshot();state.health=clamp(v,0,100);publish('character:health-changed');return snapshot();}
 function setStamina(v){if(!Number.isFinite(v))return snapshot();state.stamina=clamp(v,0,100);publish('character:stamina-changed');return snapshot();}
 function setInteractionTarget(v){state.interactionTarget=v??null;publish('character:interaction-target-changed');return snapshot();}
 function addItem(id,q=1,opts={}){if(!inventory)return{ok:false,reason:'inventory-unavailable',added:0,remaining:q};const r=inventory.add(id,q,opts);if(r.added>0)publish('character:inventory-changed');return r;}
 function removeItem(id,q=1){if(!inventory)return{ok:false,reason:'inventory-unavailable',removed:0,remaining:q};const r=inventory.remove(id,q);if(r.removed>0)publish('character:inventory-changed');return r;}
 function hasItem(id,q=1){return inventory?.has(id,q)??false;}
 function equipItem(instanceId){
  if(!inventory)return{ok:false,reason:'inventory-unavailable'};const candidate=inventory.items.find(i=>i.instanceId===instanceId);if(!candidate)return{ok:false,reason:'item-not-in-inventory'};if(candidate.quantity!==1)return{ok:false,reason:'item-stack-not-equippable'};
  const def=options.itemRegistry.get(candidate.definitionId),slot=def?.attributes?.slot;if(!EQUIPMENT_SLOTS.includes(slot))return{ok:false,reason:'item-has-no-equipment-slot'};
  const previous=state.equipment[slot],removed=inventory.removeInstance(instanceId);if(!removed)return{ok:false,reason:'item-not-in-inventory'};
  if(previous){const returned=inventory.add(previous.definitionId,1,{instanceId:previous.instanceId,durability:previous.durability,metadata:previous.metadata});if(!returned.ok){inventory.add(removed.definitionId,1,{instanceId:removed.instanceId,durability:removed.durability,metadata:removed.metadata});return{ok:false,reason:'cannot-return-current-equipment'};}}
  state.equipment[slot]=copyItem(removed);publish('character:equipment-changed');publish('character:inventory-changed');return{ok:true,slot,equipped:copyItem(removed),unequipped:copyItem(previous)};
 }
 function unequipItem(slot){if(!inventory)return{ok:false,reason:'inventory-unavailable'};if(!EQUIPMENT_SLOTS.includes(slot))return{ok:false,reason:'unknown-equipment-slot'};const current=state.equipment[slot];if(!current)return{ok:false,reason:'slot-empty'};const r=inventory.add(current.definitionId,1,{instanceId:current.instanceId,durability:current.durability,metadata:current.metadata});if(!r.ok)return{ok:false,reason:r.reason};state.equipment[slot]=null;publish('character:equipment-changed');publish('character:inventory-changed');return{ok:true,slot,returned:copyItem(current)};}
 function setEquipment(slot,item){if(!EQUIPMENT_SLOTS.includes(slot))throw new TypeError('Espaço de equipamento desconhecido.');if(item){const def=options.itemRegistry?.get(item.definitionId);if(!def||def.attributes?.slot!==slot)throw new TypeError('Item incompatível com o slot.');}state.equipment[slot]=copyItem(item);publish('character:equipment-changed');return snapshot();}
 function reset(){Object.assign(state,copyState(DEFAULT_CHARACTER_STATE));publish('character:reset');return snapshot();}
 return Object.freeze({initialize,snapshot,setMode,enterShipSeat:()=>setMode('ship-control'),leaveShipSeat:()=>setMode('on-foot'),setMovement,setLook,setGrounded,setHealth,setStamina,setInteractionTarget,setEquipment,addItem,removeItem,hasItem,equipItem,unequipItem,getInventorySnapshot,getEquippedItem:slot=>copyItem(state.equipment[slot]||null),reset});
}
