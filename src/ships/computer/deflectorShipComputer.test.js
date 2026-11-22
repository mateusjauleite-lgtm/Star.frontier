import test from 'node:test';
import assert from 'node:assert/strict';
import { createShipComputer } from './shipComputer.js';
import { registerShipComputerSystems } from './shipComputerSystems.js';

test('console do defletor controla ramificações pelo runtime compartilhado',()=>{
 const calls=[];
 const telemetry={enabled:true,energy:42,capacity:100,powerBusConnected:true,branches:[]};
 const runtime={
  snapshot:()=>({...telemetry,emitter:{enabled:false},sensors:{enabled:false},navigation:{enabled:true},protection:{enabled:false},science:{enabled:false}}),
  setCoreEnabled:value=>{calls.push(['core',value]);return {enabled:value};},
  setEmitterEnabled:value=>{calls.push(['emitter',value]);return {enabled:value};},
  setSensorsEnabled:value=>{calls.push(['sensors',value]);return {enabled:value};},
  setNavigationEnabled:value=>{calls.push(['navigation',value]);return {enabled:value};},
  setProtectionEnabled:value=>{calls.push(['protection',value]);return {enabled:value};},
  setScienceEnabled:value=>{calls.push(['science',value]);return {enabled:value};},
  setScienceMode:value=>{calls.push(['mode',value]);return {mode:value};}
 };
 const computer=createShipComputer();
 computer.registerTerminal({id:'deflector-console',systems:['deflector']});
 computer.registerTerminal({id:'other-terminal',systems:['deflector']});
 const state={speed:0,fuel:0,refinedDilithium:0};
 const ship={position:{x:0,y:0,z:0,distanceTo:()=>0}};
 registerShipComputerSystems(computer,{state,getShip:()=>ship,getShipYaw:()=>0,getPitchAngle:()=>0,getAsteroids:()=>[],deflectorRuntime:runtime});
 computer.boot();computer.connectTerminal('deflector-console');computer.connectTerminal('other-terminal');
 const status=computer.dispatch('deflector-console','deflector','status');
 assert.equal(status.ok,true);assert.equal(status.result.core.energy,42);assert.equal(status.result.navigation.enabled,true);
 assert.equal(computer.dispatch('deflector-console','deflector','setSensorsEnabled',{enabled:true}).result.accepted,true);
 assert.deepEqual(calls,[['sensors',true]]);
 assert.equal(computer.dispatch('other-terminal','deflector','setEmitterEnabled',{enabled:true}).result.accepted,false);
});
