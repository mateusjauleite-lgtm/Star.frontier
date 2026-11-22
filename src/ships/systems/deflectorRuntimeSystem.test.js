import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeflectorRuntimeSystem } from './deflectorRuntimeSystem.js';

test('Runtime atualiza ramificações sob demanda e publica telemetria',()=>{
 const state={refinedDilithium:1,deflectorCoreEnergy:0};
 const bus={draw:amount=>amount};
 const runtime=createDeflectorRuntimeSystem({state,powerBus:bus,emitter:{enabled:true},sensors:{enabled:true},
  readInputs:()=>({navigation:{available:true,position:{x:0,y:0,z:0},heading:0,speed:10},contacts:[]}),persist:()=>{}});
 runtime.initialize();const telemetry=runtime.update(.1);
 assert.equal(telemetry.transferAmount,.2);assert.equal(telemetry.emitter.active,true);
 assert.equal(telemetry.sensors.operational,true);assert.equal(telemetry.branches.length,5);
 assert.equal(state.refinedDilithium,1);assert.equal(state.deflectorCoreTelemetry,telemetry);
});
test('ramificações permanecem desligadas por padrão e não drenam reserva',()=>{
 const state={refinedDilithium:0,deflectorCoreEnergy:0.1};
 const runtime=createDeflectorRuntimeSystem({state,persist:()=>{}});
 runtime.initialize();const telemetry=runtime.update(.1);
 assert.equal(state.deflectorCoreEnergy,.1);assert.equal(telemetry.emitter.active,false);
 assert.equal(telemetry.sensors.operational,false);assert.equal(telemetry.protection.active,false);
});
test('proteção frontal solicita energia apenas quando navegação reporta risco',()=>{
 const state={deflectorCoreEnergy:2};
 const runtime=createDeflectorRuntimeSystem({state,persist:()=>{},readInputs:()=>({navigation:{available:true},contacts:[{distance:20}]})});
 runtime.setProtectionEnabled(true);runtime.update(.1);
 assert.equal(runtime.snapshot().protection.active,true);
});
test('Runtime persiste após intervalo e no encerramento',()=>{
 let saves=0;const runtime=createDeflectorRuntimeSystem({state:{deflectorCoreEnergy:5},persist:()=>{saves++;}});
 runtime.initialize();runtime.update(2.5);assert.equal(saves,0);runtime.update(2.5);assert.equal(saves,1);
 runtime.shutdown();assert.equal(saves,2);
});
