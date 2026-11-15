const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const vector3=v=>v&&v.length===3&&v.every(Number.isFinite);
const cleanZero=value=>Object.is(value,-0)||Math.abs(value)<1e-15?0:value;
function normalize(v){const n=Math.hypot(...v);return n>0?v.map(x=>cleanZero(x/n)):null;}
function dot(a,b){return a.reduce((sum,value,i)=>sum+value*b[i],0);}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]].map(cleanZero);}

/**
 * Converts geodetic longitude/latitude into the Earth mesh's local +X/+Y/+Z
 * convention. Elevation must already be converted to render units by the
 * authoritative Earth collision sampler. The returned north/east/up vectors
 * are local tangent directions; transform them through the Earth surface and
 * group matrices before using them in world-space flight guidance.
 */
export function geodeticToEarthLocalFrame({
 longitudeDeg,latitudeDeg,radiusUnits,elevationUnits=0
}){
 if(![longitudeDeg,latitudeDeg,radiusUnits,elevationUnits].every(Number.isFinite)||
    latitudeDeg < -90||latitudeDeg > 90||radiusUnits<=0)return null;
 const longitude=longitudeDeg*Math.PI/180;
 const latitude=latitudeDeg*Math.PI/180;
 const cosLatitude=Math.cos(latitude),sinLatitude=Math.sin(latitude);
 const cosLongitude=Math.cos(longitude),sinLongitude=Math.sin(longitude);
 const radius=radiusUnits+elevationUnits;
 if(radius<=0)return null;
 const clean=v=>v.map(cleanZero);
 return {
  position:clean([cosLongitude*cosLatitude*radius,sinLatitude*radius,sinLongitude*cosLatitude*radius]),
  up:clean([cosLongitude*cosLatitude,sinLatitude,sinLongitude*cosLatitude]),
  north:clean([-cosLongitude*sinLatitude,cosLatitude,-sinLongitude*sinLatitude]),
  east:clean([-sinLongitude,0,cosLongitude]),
  radiusUnits:radius
 };
}

/** Builds a tangent-frame landing attitude, with heading clockwise from true north. */
export function calculateLandingOrientation({surfaceNormal,northReference,headingDeg=0}){
 if(!vector3(surfaceNormal)||!vector3(northReference)||!Number.isFinite(headingDeg))return null;
 const up=normalize(surfaceNormal);if(!up)return null;
 const projectedNorth=northReference.map((value,i)=>value-up[i]*dot(northReference,up[i]));
 const north=normalize(projectedNorth);if(!north)return null;
 const east=normalize(cross(north,up));if(!east)return null;
 const heading=headingDeg*Math.PI/180;
 const forward=normalize(north.map((value,i)=>value*Math.cos(heading)+east[i]*Math.sin(heading)));
 if(!forward)return null;
 const right=normalize(cross(forward,up));if(!right)return null;
 return {forward,right,up,headingDeg:((headingDeg%360)+360)%360,reference:'true-north'};
}

/** Legacy visual-unit guidance, retained for compatibility; not connected to live movement. */
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
 const desiredVelocity=normal.map((v,i)=>cleanZero(-v*descent-lateral[i]*lateralGain));
 const phase=lateralDistance>8?'align':altitude>80?'approach':altitude>10?'descent':'flare';
 return {altitudeUnits:altitude,lateralErrorUnits:lateralDistance,desiredVelocity,phase};
}

/**
 * Stateful JS orchestration around the C++ Ship Core guidance calculation.
 * Input/output are SI in a local tangent frame. Authority remains guidance-only
 * until the live ship transform, physics and collision frame are normalized.
 */
export function createShipLandingAutopilot(shipKernel){
 let active=false,targetId=null;
 return {
  arm(site){
   if(!site||typeof site.id!=='string'||!site.id)return false;
   targetId=site.id;active=true;return true;
  },
  update(state){
   if(!active||!state)return null;
   const guidance=shipKernel?.calculateLandingGuidanceMeters?.({
    position:state.positionMeters,
    velocity:state.velocityMetersPerSecond,
    targetPosition:state.targetPositionMeters,
    surfaceNormal:state.surfaceNormal,
    maximumDescentSpeed:state.maximumDescentSpeed??1.5,
    lateralGain:state.lateralGain??0.08,
    verticalGain:state.verticalGain??0.15
   });
   return guidance?{...guidance,targetId,authority:'guidance-only'}:null;
  },
  cancel(){active=false;targetId=null;},
  snapshot(){return {active,targetId,authority:'guidance-only'};}
 };
}

export function isLandingEnvelopeSatisfied({
 altitudeUnits,lateralErrorUnits,speedUnitsPerSecond,maximumSlopeDeg,
 maximumLateralErrorUnits=3,maximumTouchdownSpeed=0.5,maximumSlopeAllowedDeg=5
}){
 return [altitudeUnits,lateralErrorUnits,speedUnitsPerSecond,maximumSlopeDeg].every(Number.isFinite)&&
  altitudeUnits>=0&&altitudeUnits<=0.5&&lateralErrorUnits<=maximumLateralErrorUnits&&
  speedUnitsPerSecond<=maximumTouchdownSpeed&&maximumSlopeDeg<=maximumSlopeAllowedDeg;
}
