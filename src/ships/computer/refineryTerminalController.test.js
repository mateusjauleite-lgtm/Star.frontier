import test from 'node:test';
import assert from 'node:assert/strict';
import {createRefineryTerminalController} from './refineryTerminalController.js';

function harness(){
 const connected=new Set(),calls=[],updates=[],changes=[];
 let handlers={};
 const computer={
  connectTerminal(id){connected.add(id);return true;},
  disconnectTerminal(id){connected.delete(id);},
  isTerminalConnected(id){return connected.has(id);},
  dispatch(id,system,command){calls.push([id,system,command]);return command==='status'?{ok:true,result:{available:true,rawOre:8}}:{ok:true,result:{accepted:true}};}
 };
 const renderer={
  mount(value){handlers=value;},
  setPresence(){},setOpen(){},update(value){updates.push(value);},unmount(){}
 };
 const received=[];
 const controller=createRefineryTerminalController({computer,renderer,onInteractionChange:value=>changes.push(value),onReceive:()=>received.push(true)});
 return {controller,connected,calls,updates,changes,handlers:()=>handlers,received};
}

test('terminal da Refinaria conecta, consulta inventário e encerra ao perder presença',()=>{
 const h=harness();h.controller.initialize();assert.equal(h.controller.open(),false);
 h.controller.setPresence(true,true);assert.equal(h.controller.open(),true);
 assert.equal(h.connected.has('refinery-console'),true);assert.equal(h.calls.at(-1)[2],'status');
 assert.equal(h.updates.at(-1).rawOre,8);h.controller.setPresence(false);
 assert.equal(h.connected.has('refinery-console'),false);assert.deepEqual(h.changes,[true,false]);h.controller.shutdown();
});

test('ação do compartimento de recebimento é encaminhada ao fluxo do personagem',()=>{
 const h=harness();h.controller.initialize();h.controller.setPresence(true,true);h.controller.open();
 h.handlers().onReceive();assert.deepEqual(h.received,[true]);
});
