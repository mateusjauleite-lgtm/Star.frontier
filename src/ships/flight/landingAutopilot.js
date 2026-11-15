const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const vector3=v=>v&&v.length===3&&v.every(Number.isFinite);
function normalize(v){const n=Math.hypot(...v);return n>0?v.map(x=>x/n):null;}

/** Guidance only; it does not move the live ship. Positions use render units. */
export function calculateLandingGuidance({
 currentPosition,currentVelocity=[0,0,0],targetPosition,surfaceNormal,
 maximumDescentSpeed=1.5,lateralGain=0.08,verticalGain=0.15
}){
 if(!vector3(currentPosition)||!vector3(currentVelocity)||!vector3(targetPosition)||!vector3(surfaceNormal)||
    !Number.isFinite(maximumDescentSpeed)||maximumDescentSpeed<=0)return null;
 const normal=normalize(surfaceNormal);if(!normal)return null;
 const relative=currentPosition.map((v,i)=>v-targetPosition[i]);
 const altitude=relative.reduce((sum,v,i)=>sum+v*normal[i],0);
 const lateral=relative.map((v,i)=>v-altitude*normal[i]);
 const lateralDistance=Math.hypot(...lateral);
 const descent=clamp(altitude*verticalGain,0,maximumDescentSpeed);
 const desiredVelocity=normal.map((v,i)=>-v*descent-lateral[i]*lateralGain);
 return {altitudeUnits:altitude,lateralErrorUnits:lateralDistance,desiredVelocity,
  phase:altitude>80?'approach':lateralDistance>8?'align':altitude>10?'descent':'flare'};
}
export function isLandingEnvelopeSatisfied({
 altitudeUnits,lateralErrorUnits,speedUnitsPerSecond,maximumSlopeDeg,
 maximumLateralErrorUnits=3,maximumTouchdownSpeed=0.5,maximumSlopeAllowedDeg=5
}){
 return [altitudeUnits,lateralErrorUnits,speedUnitsPerSecond,maximumSlopeDeg].every(Number.isFinite)&&
  altitudeUnits>=0&&altitudeUnits<=0.5&&lateralErrorUnits<=maximumLateralErrorUnits&&
  speedUnitsPerSecond<=maximumTouchdownSpeed&&maximumSlopeDeg<=maximumSlopeAllowedDeg;
}
