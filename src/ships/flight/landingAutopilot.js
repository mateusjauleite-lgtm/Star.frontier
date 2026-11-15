const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const vector3=v=>v&&v.length===3&&v.every(Number.isFinite);
const cleanZero=value=>Object.is(value,-0)||Math.abs(value)<1e-15?0:value;
function normalize(v){const n=Math.hypot(...v);return n>0?v.map(x=>cleanZero(x/n)):null;}
function dot(a,b){return a.reduce((sum,value,i)=>sum+value*b[i],0);}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]].map(cleanZero);}

/** Read-only adapter from live Three.js world transforms to the local SI tangent frame. */
export function createShipLandingTelemetryAdapter({metersPerRenderUnit}={}){
 if(!Number.isFinite(metersPerRenderUnit)||metersPerRenderUnit<=0)throw new TypeError('metersPerRenderUnit must be positive');
 let previousShip=null,previousTarget=null;
 return {
  sample({shipPositionWorld,targetPositionWorld,shipForwardWorld,shipUpWorld,eastWorld,upWorld,northWorld,dt}={}){
   if(![shipPositionWorld,targetPositionWorld,shipForwardWorld,shipUpWorld,eastWorld,upWorld,northWorld].every(vector3)||!Number.isFinite(dt)||dt<=0)return null;
   const east=normalize(eastWorld),up=normalize(upWorld),north=normalize(northWorld);
   if(!east||!up||!north||Math.abs(dot(east,up))>1e-4||Math.abs(dot(north,up))>1e-4||Math.abs(dot(east,north))>1e-4)return null;
   const delta=shipPositionWorld.map((v,i)=>v-targetPositionWorld[i]);
   const positionMeters=[dot(delta,east),dot(delta,up),dot(delta,north)].map(v=>cleanZero(v*metersPerRenderUnit));
   let velocityWorld=[0,0,0];
   if(previousShip&&previousTarget){
    const shipV=shipPositionWorld.map((v,i)=>(v-previousShip[i])/dt);
    const targetV=targetPositionWorld.map((v,i)=>(v-previousTarget[i])/dt);
    velocityWorld=shipV.map((v,i)=>v-targetV[i]);
   }
   previousShip=[...shipPositionWorld];previousTarget=[...targetPositionWorld];
   const velocityMetersPerSecond=[dot(velocityWorld,east),dot(velocityWorld,up),dot(velocityWorld,north)].map(v=>cleanZero(v*metersPerRenderUnit));
   const forward=normalize(shipForwardWorld),shipUp=normalize(shipUpWorld);
   if(!forward||!shipUp)return null;
   return {
    positionMeters,velocityMetersPerSecond,targetPositionMeters:[0,0,0],surfaceNormal:[0,1,0],
    shipForwardLocal:[dot(forward,east),dot(forward,up),dot(forward,north)].map(cleanZero),
    shipUpLocal:[dot(shipUp,east),dot(shipUp,up),dot(shipUp,north)].map(cleanZero),
    targetNorthLocal:[0,0,1],metersPerRenderUnit,
    source:'live-threejs-world-transform',actuationEnabled:false,
    scaleValidation:'pending-ship-metric-frame'
   };
  },
  reset(){previousShip=null;previousTarget=null;}
 };
}

/** Converts geodetic longitude/latitude into the Earth mesh's local +X/+Y/+Z convention. */
export function geodeticToEarthLocalFrame({longitudeDeg,latitudeDeg,radiusUnits,elevationUnits=0}){
 if(![longitudeDeg,latitudeDeg,radiusUnits,elevationUnits].every(Number.isFinite)||latitudeDeg < -90||latitudeDeg > 90||radiusUnits<=0)return null;
 const longitude=longitudeDeg*Math.PI/180,latitude=latitudeDeg*Math.PI/180;
 const cosLatitude=Math.cos(latitude),sinLatitude=Math.sin(latitude),cosLongitude=Math.cos(longitude),sinLongitude=Math.sin(longitude);
 const radius=radiusUnits+elevationUnits;if(radius<=0)return null;
 const clean=v=>v.map(cleanZero);
 return {position:clean([cosLongitude*cosLatitude*radius,sinLatitude*radius,sinLongitude*cosLatitude*radius]),
  up:clean([cosLongitude*cosLatitude,sinLatitude,sinLongitude*cosLatitude]),
  north:clean([-cosLongitude*sinLatitude,cosLatitude,-sinLongitude*sinLatitude]),
  east:clean([-sinLongitude,0,cosLongitude]),radiusUnits:radius};
}

/** Builds a tangent-frame landing attitude, with heading clockwise from true north. */
export function calculateLandingOrientation({surfaceNormal,northReference,headingDeg=0}){
 if(!vector3(surfaceNormal)||!vector3(northReference)||!Number.isFinite(headingDeg))return null;
 const up=normalize(surfaceNormal);if(!up)return null;
 const north=normalize(northReference.map((v,i)=>v-up[i]*dot(northReference,up)));if(!north)return null;
 const east=normalize(cross(north,up));if(!east)return null;
 const heading=headingDeg*Math.PI/180;
 const forward=normalize(north.map((v,i)=>v*Math.cos(heading)+east[i]*Math.sin(heading)));if(!forward)return null;
 const right=normalize(cross(forward,up));if(!right)return null;
 return {forward,right,up,headingDeg:((headingDeg%360)+360)%360,reference:'true-north'};
}

/** Legacy visual-unit guidance retained for compatibility. */
export function calculateLandingGuidance({currentPosition,currentVelocity=[0,0,0],targetPosition,surfaceNormal,maximumDescentSpeed=1.5,lateralGain=0.08,verticalGain=0.15}){
 if(!vector3(currentPosition)||!vector3(currentVelocity)||!vector3(targetPosition)||!vector3(surfaceNormal)||!Number.isFinite(maximumDescentSpeed)||maximumDescentSpeed<=0)return null;
 const normal=normalize(surfaceNormal);if(!normal)return null;
 const relative=currentPosition.map((v,i)=>v-targetPosition[i]),altitude=dot(relative,normal);
 const lateral=relative.map((v,i)=>v-altitude*normal[i]),lateralDistance=Math.hypot(...lateral);
 const descent=clamp(altitude*verticalGain,0,maximumDescentSpeed);
 const desiredVelocity=normal.map((v,i)=>cleanZero(-v*descent-lateral[i]*lateralGain));
 const phase=lateralDistance>8?'align':altitude>80?'approach':altitude>10?'descent':'flare';
 return {altitudeUnits:altitude,lateralErrorUnits:lateralDistance,desiredVelocity,phase};
}

/** C++ Ship Core orchestration; guidance never directly moves the rendered ship. */
export function createShipLandingAutopilot(shipKernel){
 let active=false,targetId=null;
 return {
  arm(site){if(!site||typeof site.id!=='string'||!site.id)return false;targetId=site.id;active=true;return true;},
  update(state){
   if(!active||!state)return null;
   const guidance=shipKernel?.calculateLandingGuidanceMeters?.({
    position:state.positionMeters,velocity:state.velocityMetersPerSecond,targetPosition:state.targetPositionMeters,
    surfaceNormal:state.surfaceNormal,shipForward:state.shipForwardLocal,shipUp:state.shipUpLocal,targetNorth:state.targetNorthLocal,
    maximumDescentSpeed:state.maximumDescentSpeed??1.5,lateralGain:state.lateralGain??0.08,verticalGain:state.verticalGain??0.15
   });
   return guidance?{...guidance,targetId,authority:'guidance-only',actuationEnabled:false,
    coordinateFrame:state.coordinateFrame??'earth-local-tangent',telemetrySource:state.source,scaleValidation:state.scaleValidation}:null;
  },
  cancel(){active=false;targetId=null;},
  snapshot(){return {active,targetId,authority:'guidance-only',actuationEnabled:false};}
 };
}

export function isLandingEnvelopeSatisfied({altitudeUnits,lateralErrorUnits,speedUnitsPerSecond,maximumSlopeDeg,maximumLateralErrorUnits=3,maximumTouchdownSpeed=0.5,maximumSlopeAllowedDeg=5}){
 return [altitudeUnits,lateralErrorUnits,speedUnitsPerSecond,maximumSlopeDeg].every(Number.isFinite)&&altitudeUnits>=0&&altitudeUnits<=0.5&&lateralErrorUnits<=maximumLateralErrorUnits&&speedUnitsPerSecond<=maximumTouchdownSpeed&&maximumSlopeDeg<=maximumSlopeAllowedDeg;
}
