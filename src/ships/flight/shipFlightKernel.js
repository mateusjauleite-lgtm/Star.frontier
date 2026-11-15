const EARTH_MU_M3_S2=3.986004418e14;
const finiteVector=v=>v&&v.length===3&&Array.from(v).every(Number.isFinite);
const cleanZero=value=>Object.is(value,-0)||Math.abs(value)<1e-15?0:value;
const dot=(a,b)=>a.reduce((sum,value,i)=>sum+value*b[i],0);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function gravityFallback(p,mu){
 if(!finiteVector(p)||!Number.isFinite(mu)||mu<=0)return null;
 const r2=p[0]**2+p[1]**2+p[2]**2;if(!Number.isFinite(r2)||r2<=0)return null;
 const factor=-mu/(r2*Math.sqrt(r2));return p.map(v=>cleanZero(v*factor));
}
function integrateFallback(p,v,mu,dt){
 if(!finiteVector(p)||!finiteVector(v)||!Number.isFinite(mu)||mu<=0||!Number.isFinite(dt)||dt<=0)return null;
 const a0=gravityFallback(p,mu);if(!a0)return null;
 const next=p.map((x,i)=>x+v[i]*dt+0.5*a0[i]*dt*dt);
 const a1=gravityFallback(next,mu);if(!a1)return null;
 return {position:next,velocity:v.map((x,i)=>x+0.5*(a0[i]+a1[i])*dt)};
}
function landingGuidanceFallback({position,velocity,targetPosition,surfaceNormal,maximumDescentSpeed,lateralGain,verticalGain}){
 if(!finiteVector(position)||!finiteVector(velocity)||!finiteVector(targetPosition)||!finiteVector(surfaceNormal)||
    !Number.isFinite(maximumDescentSpeed)||maximumDescentSpeed<=0||
    !Number.isFinite(lateralGain)||lateralGain<0||!Number.isFinite(verticalGain)||verticalGain<0)return null;
 const length=Math.hypot(...surfaceNormal);if(!Number.isFinite(length)||length<=1e-12)return null;
 const up=surfaceNormal.map(v=>v/length);
 const relative=position.map((v,i)=>v-targetPosition[i]);
 const altitude=dot(relative,up);
 const lateral=relative.map((v,i)=>v-altitude*up[i]);
 const lateralDistance=Math.hypot(...lateral);
 const verticalVelocity=dot(velocity,up);
 const descent=clamp(altitude*verticalGain-verticalVelocity*0.35,0,maximumDescentSpeed);
 const lateralVelocity=velocity.map((v,i)=>v-verticalVelocity*up[i]);
 let lateralCommand=lateral.map((v,i)=>-v*lateralGain-lateralVelocity[i]*0.5);
 const commandLength=Math.hypot(...lateralCommand);
 if(commandLength>5)lateralCommand=lateralCommand.map(v=>v*5/commandLength);
 const desiredVelocity=lateralCommand.map((v,i)=>cleanZero(v-up[i]*descent));
 const phase=lateralDistance>8?'align':altitude>80?'approach':altitude>10?'descent':'flare';
 return {altitudeMeters:cleanZero(altitude),lateralErrorMeters:cleanZero(lateralDistance),
  desiredVelocityMetersPerSecond:desiredVelocity,phase};
}
export function createShipFlightKernel(module=null){
 let disposed=false;
 return {
  backend:module?'wasm-c++':'javascript-fallback',
  earthGravitationalParameter:EARTH_MU_M3_S2,
  gravityAcceleration(p,mu=EARTH_MU_M3_S2){
   if(disposed)return null;if(!module)return gravityFallback(p,mu);
   if(!finiteVector(p)||!Number.isFinite(mu)||mu<=0)return null;
   const out=[0,1,2].map(axis=>module._ship_gravity_acceleration_component(p[0],p[1],p[2],mu,axis));
   return out.every(Number.isFinite)?out:null;
  },
  integrateOrbitStep(p,v,mu=EARTH_MU_M3_S2,dt){
   if(disposed)return null;if(!module)return integrateFallback(p,v,mu,dt);
   if(!finiteVector(p)||!finiteVector(v)||!Number.isFinite(mu)||mu<=0||!Number.isFinite(dt)||dt<=0)return null;
   const pp=module._malloc(24),vp=module._malloc(24);
   if(!pp||!vp){if(pp)module._free(pp);if(vp)module._free(vp);return null;}
   try{
    module.HEAPF64.set(p,pp/8);module.HEAPF64.set(v,vp/8);
    if(!module._ship_integrate_orbit_step(pp,vp,mu,dt))return null;
    return {position:Array.from(module.HEAPF64.subarray(pp/8,pp/8+3)),velocity:Array.from(module.HEAPF64.subarray(vp/8,vp/8+3))};
   }finally{module._free(pp);module._free(vp);}
  },
  calculateLandingGuidanceMeters({
   position,velocity=[0,0,0],targetPosition,surfaceNormal,
   maximumDescentSpeed=1.5,lateralGain=0.08,verticalGain=0.15
  }={}){
   if(disposed)return null;
   const input={position,velocity,targetPosition,surfaceNormal,maximumDescentSpeed,lateralGain,verticalGain};
   if(!module)return landingGuidanceFallback(input);
   if(!finiteVector(position)||!finiteVector(velocity)||!finiteVector(targetPosition)||!finiteVector(surfaceNormal)||
      ![maximumDescentSpeed,lateralGain,verticalGain].every(Number.isFinite))return null;
   const ptr=module._malloc(18*8);
   if(!ptr)return null;
   try{
    const offset=ptr/8;
    module.HEAPF64.set([...position,...velocity,...targetPosition,...surfaceNormal],offset);
    const ok=module._ship_calculate_landing_guidance(
     ptr,ptr+3*8,ptr+6*8,ptr+9*8,maximumDescentSpeed,lateralGain,verticalGain,ptr+12*8,ptr+15*8
    );
    if(!ok)return null;
    const metrics=module.HEAPF64.subarray(offset+15,offset+18);
    const phase=['align','approach','descent','flare'][metrics[2]];
    if(!phase||!Number.isFinite(metrics[0])||!Number.isFinite(metrics[1]))return null;
    return {altitudeMeters:metrics[0],lateralErrorMeters:metrics[1],
     desiredVelocityMetersPerSecond:Array.from(module.HEAPF64.subarray(offset+12,offset+15)),phase};
   }finally{module._free(ptr);}
  },
  dispose(){disposed=true;}
 };
}
export async function loadShipFlightKernel(){
 const base=import.meta.env?.BASE_URL??'./';
 const url=new URL(\`\${base}ship/shipFlightKernel.js\`,globalThis.location?.href??'http://localhost/');
 try{
  const imported=await import(/* @vite-ignore */url.href);
  if(typeof imported.default!=='function')throw new Error('Ship flight WASM factory is missing');
  const wasm=await imported.default({locateFile:file=>new URL(file,url).href});
  return createShipFlightKernel(wasm);
 }catch{return createShipFlightKernel();}
}
