import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeflectorCoreSystem } from './deflectorCoreSystem.js';

function setup(overrides={},options={}) {
 const state={refinedDilithium:20,deflectorCoreEnergy:0,...overrides};
 const supplied={value:0};
 const powerBus=options.powerBus||{draw(amount){const n=Math.min(amount,supplied.value);supplied.value-=n;return n;}};
 const core=createDeflectorCoreSystem(state,{...options,powerBus});
 return {state,core,supplied};
}
test('núcleo recebe energia elétrica do barramento sem consumir dilítio',()=>{
 const {state,core,supplied}=setup({}, {chargeRate:1}); supplied.value=2;
 const status=core.update(.25);
 assert.equal(state.deflectorCoreEnergy,.25); assert.equal(state.refinedDilithium,20);
 assert.equal(status.transferAmount,.25); assert.equal(status.source,'ship-power-bus');
});
test('núcleo não carrega quando o barramento não fornece energia',()=>{
 const {state,core}=setup({refinedDilithium:100});
 core.update(1); assert.equal(state.deflectorCoreEnergy,0); assert.equal(state.refinedDilithium,100);
});
test('capacidade limita a energia solicitada ao barramento',()=>{
 let requested=0; const powerBus={draw(amount){requested=amount;return amount;}};
 const {state,core}=setup({deflectorCoreEnergy:9.95},{capacity:10,chargeRate:5,powerBus});
 core.update(.1); assert.ok(Math.abs(requested-.05)<1e-9); assert.equal(state.deflectorCoreEnergy,10);
});
test('desligar carregamento preserva reserva local e não chama barramento',()=>{
 let calls=0;const {state,core}=setup({}, {powerBus:{draw(){calls++;return 1;}}});
 core.setChargingEnabled(false);core.update(.1);assert.equal(calls,0);assert.equal(state.deflectorCoreEnergy,0);
});
test('ramificações consomem apenas a reserva local',()=>{
 const {state,core}=setup({deflectorCoreEnergy:2});
 core.registerBranch('test',{maxDrawPerSecond:5});core.setChargingEnabled(false);core.update(.1);
 assert.equal(core.consumeEnergy('test',.4,.1).consumed,.4);
 assert.equal(state.deflectorCoreEnergy,1.6);assert.equal(state.refinedDilithium,20);
});
test('limite de consumo por frame não pode ser contornado por chamadas repetidas',()=>{
 const {core}=setup({deflectorCoreEnergy:5});core.registerBranch('test',{maxDrawPerSecond:2});core.update(.25);
 assert.equal(core.consumeEnergy('test',.4,.25).consumed,.4);
 assert.ok(Math.abs(core.consumeEnergy('test',.4,.25).consumed-.1)<1e-9);
});
test('núcleo desligado bloqueia consumo',()=>{
 const {state,core}=setup({deflectorCoreEnergy:2});core.registerBranch('test');core.update(0);core.setEnabled(false);
 assert.equal(core.consumeEnergy('test',.2,.1).consumed,0);assert.equal(state.deflectorCoreEnergy,2);
});
test('ramificações não recebem energia quando o barramento está sem fornecimento',()=>{
 const {state,core}=setup({refinedDilithium:0,deflectorCoreEnergy:0});core.registerBranch('test');core.update(.5);
 assert.equal(core.consumeEnergy('test',.1,.5).consumed,0);assert.equal(state.refinedDilithium,0);
});
