import test from 'node:test';
import assert from 'node:assert/strict';
import { createShipComputer } from './shipComputer.js';
import { createDeflectorTerminalController } from './deflectorTerminalController.js';

function makeTerminal() {
  const computer=createShipComputer();
  computer.registerTerminal({id:'deflector-console',systems:['deflector']});
  computer.registerSystem('deflector',{commands:{status:()=>({online:true})}});
  computer.boot();
  const changes=[];
  const terminal=createDeflectorTerminalController({computer,onInteractionChange:value=>changes.push(value)});
  terminal.initialize();
  return {computer,terminal,changes};
}
test('terminal interno conecta ao Ship Computer somente quando presente e próximo',()=>{
 const {terminal,changes}=makeTerminal();
 assert.equal(terminal.open(),false);
 terminal.setPresence(true,true);
 assert.equal(terminal.open(),true);
 assert.equal(terminal.dispatch('deflector','status').result.online,true);
 terminal.close();
 assert.deepEqual(changes,[true,false]);
});
test('terminal fecha e revoga conexão ao sair da câmara',()=>{
 const {terminal}=makeTerminal();
 terminal.setPresence(true,true);assert.equal(terminal.open(),true);
 terminal.setPresence(false,false);
 assert.equal(terminal.getSnapshot().connected,false);
 assert.equal(terminal.dispatch('deflector','status').ok,false);
});
