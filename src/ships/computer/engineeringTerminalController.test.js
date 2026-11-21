import test from 'node:test';
import assert from 'node:assert/strict';
import { createShipComputer } from './shipComputer.js';
import { createEngineeringTerminalController } from './engineeringTerminalController.js';

function makeTerminal() {
  const computer=createShipComputer();
  computer.registerTerminal({id:'engineering-console',systems:['engineering']});
  computer.registerSystem('engineering',{commands:{status:()=>({warpDriveCharge:80})}});
  computer.boot();
  const changes=[];
  const terminal=createEngineeringTerminalController({computer,onInteractionChange:active=>changes.push(active)});
  terminal.initialize();
  return {computer,terminal,changes};
}
test('console conecta ao terminal autorizado do Ship Computer',()=>{
  const {terminal,changes}=makeTerminal();
  assert.equal(terminal.open(),false);
  terminal.setPresence(true,true);
  assert.equal(terminal.open(),true);
  assert.equal(terminal.getSnapshot().connected,true);
  assert.equal(terminal.dispatch('engineering','status').result.warpDriveCharge,80);
  terminal.close();
  assert.deepEqual(changes,[true,false]);
});
test('console desconecta ao sair da área de interação',()=>{
  const {terminal}=makeTerminal();
  terminal.setPresence(true,true);
  assert.equal(terminal.open(),true);
  terminal.setPresence(true,false);
  assert.equal(terminal.getSnapshot().connected,false);
  assert.equal(terminal.dispatch('engineering','status').ok,false);
});
test('terminal não despacha comandos quando está desconectado',()=>{
  const {terminal}=makeTerminal();
  assert.deepEqual(terminal.dispatch('engineering','status'),{ok:false,reason:'engineering-terminal-inactive'});
});
