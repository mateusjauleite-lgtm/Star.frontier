const EARTH_MU_M3_S2=3.986004418e14;
const finiteVector=v=>v&&v.length===3&&Array.from(v).every(Number.isFinite);
const cleanZero=v=>Object.is(v,-0)||Math.abs(v)<1e-15?0:v;
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const normalize=v=>{const n=Math.hypot(...v);return n>1e-12?v.map(x=>x/n):null;};
function gravityFallback(p,mu){
 if(!finiteVector(p)||!Number.isFinite(mu)||mu<=0)return null;
 const r2=dot(p,p);if(!Number.isFinite(r2)||r2<=0)return null;
 return p.map(v=>cleanZero(v*-mu/(r2*Math.sqrt(r2))));
}
function integrateFallback(p,v,mu,dt){
 if(!finiteVector(p)||!finiteVector(v)||!Number.isFinite(mu)||mu<=0||!Number.isFinite(dt)||dt<=0)return null;
 const a0=gravityFallback(p,mu);if(!a0)return null;
 const next=p.map((x,i)=>x+v[i]*dt+0.5*a0[i]*dt*dt),a1=gravityFallback(next,mu);if(!a1)return null;
 return {position:next,velocity:v.map((x,i)=>x+0.5*(a0[i]+a1[i])*dt)};
}
function landingFallback({position,velocity,targetPosition,surfaceNormal,shipForward,shipUp,targetNorth,maxDescentSpeed,lateralGain,verticalGain}){
 if(![position,velocity,targetPosition,surfaceNormal,shipForward,shipUp,targetNorth].every(finiteVector)||
 ![maxDescentSpeed,lateralGain,verticalGain].every(Number.isFinite)||maxDescentSpeed<=0||lateralGain<0||verticalGain<0)return null;
 const up=normalize(surfaceNormal),forward=normalize(shipForward),vertical=normalize(shipUp);if(!up||!forward||!vertical)return null;
 const attitude=Math.acos(clamp(dot(vertical,up),-1,1))*180/Math.PI;
 const northComponent=dot(targetNorth,up),north=normalize(targetNorth.map((v,i)=>v-northComponent*up[i]));if(!north)return null;
 const fv=dot(forward,up),horizontal=normalize(forward.map((v,i)=>v-fv*up[i]))||[0,0,0];
 const east=normalize([up[1]*north[2]-up[2]*north[1],up[2]*north[0]-up[0]*north[2],up[0]*north[1]-up[1]*north[0]]);
 if(!east)return null;
 const heading=Math.atan2(dot(horizontal,east),dot(horizontal,north))*180/Math.PI;
 const relative=position.map((v,i)=>v-targetPosition[i]),altitude=dot(relative,up);
 const lateral=relative.map((v,i)=>v-altitude*up[i]),lateralDistance=Math.hypot(...lateral);
 const verticalVelocity=dot(velocity,up),descent=clamp(altitude*verticalGain-verticalVelocity*0.35,0,maxDescentSpeed);
 const lateralVelocity=velocity.map((v,i)=>v-verticalVelocity*up[i]);
 let command=lateral.map((v,i)=>-v*lateralGain-lateralVelocity[i]*0.5);
 const commandLength=Math.hypot(...command);if(commandLength>5)command=command.map(v=>v*5/commandLength);
 const desired=command.map((v,i)=>cleanZero(v-up[i]*descent));
 const phase=lateralDistance>8?'align':altitude>80?'approach':altitude>10?'descent':'flare';
 return {altitudeMeters:cleanZero(altitude),lateralErrorMeters:cleanZero(lateralDistance),desiredVelocityMetersPerSecond:desired,phase,attitudeErrorDegrees:cleanZero(attitude),headingErrorDegrees:cleanZero(heading)};
}
export function createShipFlightKernel(module=null){
 let disposed=false;
 return {
  backend:module?'wasm-c++':'javascript-fallback',
  earthGravitationalParameter:EARTH_MU_M3_S2,
  gravityAcceleration(p,mu=EARTH_MU_M3_S2){
   if(disposed)return null;if(!module)return gravityFallback(p,mu);
   if(!finiteVector(p)||!Number.isFinite(mu)||mu<=0)return null;
   const out=[0,1,2].map(i=>module._ship_gravity_acceleration_component(p[0],p[1],p[2],mu,i));
   return out.every(Number.isFinite)?out:null;
  },
  integrateOrbitStep(p,v,mu=EARTH_MU_M3_S2,dt){
   if(disposed)return null;if(!module)return integrateFallback(p,v,mu,dt);
   if(!finiteVector(p)||!finiteVector(v)||!Number.isFinite(mu)||mu<=0||!Number.isFinite(dt)||dt<=0)return null;
   const pp=module._malloc(24),vp=module._malloc(24);if(!pp||!vp){if(pp)module._free(pp);if(vp)module._free(vp);return null;}
   try{module.HEAPF64.set(p,pp/8);module.HEAPF64.set(v,vp/8);if(!module._ship_integrate_orbit_step(pp,vp,mu,dt))return null;
    return {position:Array.from(module.HEAPF64.subarray(pp/8,pp/8+3)),velocity:Array.from(module.HEAPF64.subarray(vp/8,vp/8+3))};
   }finally{module._free(pp);module._free(vp);}
  },
  calculateLandingGuidanceMeters({position,velocity=[0,0,0],targetPosition=[0,0,0],surfaceNormal,shipForward=[0,0,1],shipUp=[0,1,0],targetNorth=[0,0,1],maximumDescentSpeed=1.5,lateralGain=0.08,verticalGain=0.15}={}){
   if(disposed)return null;
   const input={position,velocity,targetPosition,surfaceNormal,shipForward,shipUp,targetNorth,maxDescentSpeed:maximumDescentSpeed,lateralGain,verticalGain};
   if(!module)return landingFallback(input);
   if(![position,velocity,targetPosition,surfaceNormal,shipForward,shipUp,targetNorth].every(finiteVector)||
    ![maximumDescentSpeed,lateralGain,verticalGain].every(Number.isFinite)||maximumDescentSpeed<=0||lateralGain<0||verticalGain<0)return null;
   const ptr=module._malloc(29*8);if(!ptr)return null;
   try{
    const o=ptr/8;module.HEAPF64.set([...position,...velocity,...targetPosition,...surfaceNormal,...shipForward,...shipUp,...targetNorth],o);
    const ok=module._ship_calculate_landing_guidance(ptr,ptr+24,ptr+48,ptr+72,ptr+96,ptr+120,ptr+144,maximumDescentSpeed,lateralGain,verticalGain,ptr+168,ptr+192);
    if(!ok)return null;
    const metrics=Array.from(module.HEAPF64.subarray(o+24,o+29)),phase=['align','approach','descent','flare'][metrics[2]];
    if(!phase||!metrics.every(Number.isFinite))return null;
    return {altitudeMeters:metrics[0],lateralErrorMeters:metrics[1],desiredVelocityMetersPerSecond:Array.from(module.HEAPF64.subarray(o+21,o+24)),phase,attitudeErrorDegrees:metrics[3],headingErrorDegrees:metrics[4]};
   }finally{module._free(ptr);}
  },
  dispose(){disposed=true;}
 };
}
export async function loadShipFlightKernel(){
 const base=import.meta.env?.BASE_URL??'./';
 const url=new URL(base+'ship/shipFlightKernel.js',globalThis.location?.href??'http://localhost/');
 try{const imported=await import(/* @vite-ignore */url.href);if(typeof imported.default!=='function')throw new Error('Ship flight WASM factory is missing');
  const wasm=await imported.default({locateFile:file=>new URL(file,url).href});return createShipFlightKernel(wasm);
 }catch{return createShipFlightKernel();}
}
