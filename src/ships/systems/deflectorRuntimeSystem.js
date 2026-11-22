import { state as sharedState } from '../../core/state.js';
import { saveState } from '../../core/storage.js';
import { createDeflectorCoreSystem } from './deflectorCoreSystem.js';
import { createDeflectorEmitterSystem } from './deflectorEmitterSystem.js';
import { createDeflectorSensorSystem } from './deflectorSensorSystem.js';
import { createDeflectorNavigationSystem } from './deflectorNavigationSystem.js';
import { createDeflectorProtectionSystem } from './deflectorProtectionSystem.js';
import { createDeflectorScienceSystem } from './deflectorScienceSystem.js';

const AUTOSAVE_INTERVAL_SECONDS=5;
export function createDeflectorRuntimeSystem(options={}) {
 const state=options.state||sharedState;
 if(!state||typeof state!=='object')throw new TypeError('O estado da nave é obrigatório.');
 const persist=typeof options.persist==='function'?options.persist:saveState;
 const core=createDeflectorCoreSystem(state,{...options.core,powerBus:options.powerBus||options.core?.powerBus||null});
 const emitter=createDeflectorEmitterSystem(core,{...options.emitter,enabled:options.emitter?.enabled===true});
 const sensors=createDeflectorSensorSystem(core,{...options.sensors,enabled:options.sensors?.enabled===true});
 const navigation=createDeflectorNavigationSystem(core,options.navigation);
 const protection=createDeflectorProtectionSystem(core,options.protection);
 const science=createDeflectorScienceSystem(core,options.science);
 const readInputs=typeof options.readInputs==='function'?options.readInputs:()=>({});
 let elapsed=0,telemetry=null;
 function update(deltaSeconds) {
  const dt=Math.max(0,finite(deltaSeconds)),input=readInputs()||{};
  const coreStatus=core.update(dt);
  const sensorStatus=sensors.update(dt,input);
  const navigationStatus=navigation.update(dt,{...input,contacts:input.contacts||sensorStatus.contacts||[]});
  const protectionStatus=protection.update(dt,{...input,routeRisk:navigationStatus.routeRisk});
  const emitterStatus=emitter.update(dt,{...input,protection:protectionStatus});
  const scienceStatus=science.update(dt,input);
  telemetry=Object.freeze({...coreStatus,emitter:emitterStatus,sensors:sensorStatus,
   navigation:navigationStatus,protection:protectionStatus,science:scienceStatus});
  state.deflectorCoreTelemetry=telemetry;
  elapsed+=dt;
  if(elapsed>=AUTOSAVE_INTERVAL_SECONDS){elapsed%=AUTOSAVE_INTERVAL_SECONDS;persist();}
  return telemetry;
 }
 function shutdown(){persist();}
 function initialize(){telemetry=Object.freeze({...core.snapshot(),emitter:emitter.snapshot(),sensors:sensors.snapshot(),navigation:navigation.snapshot(),protection:protection.snapshot(),science:science.snapshot()});state.deflectorCoreTelemetry=telemetry;}
 return Object.freeze({priority:45,initialize,update,shutdown,snapshot:()=>telemetry||core.snapshot(),
  setCoreEnabled:v=>core.setEnabled(v),setChargingEnabled:v=>core.setChargingEnabled(v),
  setEmitterEnabled:v=>emitter.setEnabled(v),setSensorsEnabled:v=>sensors.setEnabled(v),
  setNavigationEnabled:v=>navigation.setEnabled(v),setProtectionEnabled:v=>protection.setEnabled(v),
  setScienceEnabled:v=>science.setEnabled(v),setScienceMode:v=>science.setMode(v)});
}
function finite(v){const n=Number(v);return Number.isFinite(n)?n:0;}
