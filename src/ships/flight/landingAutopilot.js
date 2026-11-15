const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const vector3=v=>v&&v.length===3&&v.every(Number.isFinite);
function normalize(v){const n=Math.hypot(...v);return n>0?v.map(x=>x/n):null;}
function dot(a,b){return a.reduce((sum,value,i)=>sum+value*b[i],0);}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}

/**
 * Builds a tangent-frame landing attitude.
 * northReference is true north transformed into the same world frame as surfaceNormal.
 * Heading is degrees clockwise from true north. Returns basis vectors, not a live ship command.
 */
export function calculateLandingOrientation({
 surfaceNormal,northReference,headingDeg=0
}){
 if(!vector3(surfaceNormal)||!vector3(northReference)||!Number.isFinite(headingDeg))return null;
 const up=normalize(surfaceNormal);if(!up)return null;
 const projectedNorth=northReference.map((value,i)=>value-up[i]*dot(northReference,up));
 const north=normalize(projectedNorth);if(!north)return null;
 const east=normalize(cross(north,up));if(!east)return null;
 const heading=THREE_DEG_TO_RAD(headingDeg);
 const forward=normalize(north.map((value,i)=>value*Math.cos(heading)+east[i]*Math.sin(heading)));
 if(!forward)return null;
 const right=normalize(cross(forward,up));if(!right)return null;
 return {forward,right,up,headingDeg:((headingDeg%360)+360)%360,reference:'true-north'};
}
function THREE_DEG_TO_RAD(degrees){return degrees*Math.PI/180;}

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
 const phase=lateralDistance>8?'align':altitude>80?'approach':altitude>10?'descent':'flare';
 return {altitudeUnits:altitude,lateralErrorUnits:lateralDistance,desiredVelocity,phase};
}
export function isLandingEnvelopeSatisfied({
 altitudeUnits,lateralErrorUnits,speedUnitsPerSecond,maximumSlopeDeg,
 maximumLateralErrorUnits=3,maximumTouchdownSpeed=0.5,maximumSlopeAllowedDeg=5
}){
 return [altitudeUnits,lateralErrorUnits,speedUnitsPerSecond,maximumSlopeDeg].every(Number.isFinite)&&
  altitudeUnits>=0&&altitudeUnits<=0.5&&lateralErrorUnits<=maximumLateralErrorUnits&&
  speedUnitsPerSecond<=maximumTouchdownSpeed&&maximumSlopeDeg<=maximumSlopeAllowedDeg;
}
