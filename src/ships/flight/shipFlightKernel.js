const EARTH_MU_M3_S2=3.986004418e14;
const finiteVector=v=>v&&v.length===3&&Array.from(v).every(Number.isFinite);
function gravityFallback(p,mu){
 if(!finiteVector(p)||!Number.isFinite(mu)||mu<=0)return null;
 const r2=p[0]**2+p[1]**2+p[2]**2;if(!Number.isFinite(r2)||r2<=0)return null;
 const factor=-mu/(r2*Math.sqrt(r2));return p.map(v=>v*factor);
}
function integrateFallback(p,v,mu,dt){
 if(!finiteVector(p)||!finiteVector(v)||!Number.isFinite(mu)||mu<=0||!Number.isFinite(dt)||dt<=0)return null;
 const a0=gravityFallback(p,mu);if(!a0)return null;
 const next=p.map((x,i)=>x+v[i]*dt+0.5*a0[i]*dt*dt);
 const a1=gravityFallback(next,mu);if(!a1)return null;
 return {position:next,velocity:v.map((x,i)=>x+0.5*(a0[i]+a1[i])*dt)};
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
  dispose(){disposed=true;}
 };
}
export async function loadShipFlightKernel(){
 const base=import.meta.env?.BASE_URL??'./';
 const url=new URL(`${base}ship/shipFlightKernel.js`,globalThis.location?.href??'http://localhost/');
 try{
  const imported=await import(/* @vite-ignore */url.href);
  if(typeof imported.default!=='function')throw new Error('Ship flight WASM factory is missing');
  const wasm=await imported.default({locateFile:file=>new URL(file,url).href});
  return createShipFlightKernel(wasm);
 }catch{return createShipFlightKernel();}
}
