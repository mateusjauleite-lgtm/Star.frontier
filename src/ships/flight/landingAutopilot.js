const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const vector3=v=>v&&v.length===3&&v.every(Number.isFinite);
const cleanZero=value=>Object.is(value,-0)||Math.abs(value)<1e-15?0:value;
function normalize(v){const n=Math.hypot(...v);return n>0?v.map(x=>cleanZero(x/n)):null;}
function dot(a,b){return a.reduce((sum,value,i)=>sum+value*b[i],0);}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]].map(cleanZero);}

/** Physical calibration for the current ship model: one authored geometry unit represents one metre. */
export const SHIP_MODEL_METERS_PER_UNIT = 1;
export const SHIP_LANDING_PLATFORM_DECK_HEIGHT_METERS = 0.76;
export const SHIP_LANDING_TARGET_HEIGHT_METERS = 23.94;

/**
 * Converts the ship origin and four landing-gear anchors into the platform's
 * metric local frame. The platform parent carries Earth-units-per-metre scale,
 * so Object3D.worldToLocal() returns metres directly.
 * Axes returned to Ship Core are [east, up, north].
 */
export function createShipLandingMetricTelemetryAdapter({
 modelMetersPerUnit=SHIP_MODEL_METERS_PER_UNIT,
 deckHeightMeters=SHIP_LANDING_PLATFORM_DECK_HEIGHT_METERS,
 deckRadiusMeters=108
}={}){
 if(!Number.isFinite(modelMetersPerUnit)||modelMetersPerUnit<=0||
    !Number.isFinite(deckHeightMeters)||!Number.isFinite(deckRadiusMeters)||deckRadiusMeters<=0)
  throw new TypeError('Invalid ship/platform metric calibration');
 let previousPosition=null;
 return {
  sample({shipOriginPlatformLocalMeters,shipRotationRelativeToPlatform,contactPoints=[],dt}={}){
   if(!vector3(shipOriginPlatformLocalMeters)||!Array.isArray(shipRotationRelativeToPlatform)||
      shipRotationRelativeToPlatform.length!==4||!shipRotationRelativeToPlatform.every(Number.isFinite)||
      !Number.isFinite(dt)||dt<=0||!Array.isArray(contactPoints)||contactPoints.length!==4)return null;
   const [qx,qy,qz,qw]=shipRotationRelativeToPlatform;
   const qLength=Math.hypot(qx,qy,qz,qw);
   if(!Number.isFinite(qLength)||qLength<1e-9)return null;
   const q=[qx/qLength,qy/qLength,qz/qLength,qw/qLength];
   const rotate=v=>{
    const [x,y,z]=v,[ax,ay,az,aw]=q;
    const tx=2*(ay*z-az*y),ty=2*(az*x-ax*z),tz=2*(ax*y-ay*x);
    return [x+aw*tx+(ay*tz-az*ty),y+aw*ty+(az*tx-ax*tz),z+aw*tz+(ax*ty-ay*tx)];
   };
   const positionMeters=[shipOriginPlatformLocalMeters[0],shipOriginPlatformLocalMeters[1],-shipOriginPlatformLocalMeters[2]].map(cleanZero);
   const forwardPlatform=rotate([0,0,-1]),upPlatform=rotate([0,1,0]);
   const toAxes=v=>[cleanZero(v[0]),cleanZero(v[1]),cleanZero(-v[2])];
   const gear=[];
   for(const item of contactPoints){
    if(!item||typeof item.id!=='string'||!vector3(item.point))return null;
    const offsetAxes=toAxes(rotate(item.point.map(v=>v*modelMetersPerUnit)));
    const position=positionMeters.map((v,i)=>cleanZero(v+offsetAxes[i]));
    gear.push({id:item.id,positionMeters:position,
     clearanceMeters:cleanZero(position[1]-deckHeightMeters),
     radialDistanceMeters:cleanZero(Math.hypot(position[0],position[2]))});
   }
   const velocitySampleValid=Boolean(previousPosition);
   const velocity=previousPosition
    ?positionMeters.map((v,i)=>cleanZero((v-previousPosition[i])/dt))
    :[0,0,0];
   previousPosition=[...positionMeters];
   return {
    positionMeters,velocityMetersPerSecond:velocity,velocitySampleValid,
    targetPositionMeters:[0,SHIP_LANDING_TARGET_HEIGHT_METERS,0],
    surfaceNormal:[0,1,0],
    shipForwardLocal:toAxes(forwardPlatform),shipUpLocal:toAxes(upPlatform),
    targetNorthLocal:[0,0,1],contactPointsMeters:gear,
    allGearInsideDeck:gear.every(point=>point.radialDistanceMeters<=deckRadiusMeters),
    minimumGearClearanceMeters:Math.min(...gear.map(point=>point.clearanceMeters)),
    maximumGearClearanceMeters:Math.max(...gear.map(point=>point.clearanceMeters)),
    modelMetersPerUnit,coordinateFrame:'platform-local-metric',
    source:'ship-model-and-platform-world-matrices',
    scaleValidation:'platform-local-metric-frame',
    actuationEnabled:false
   };
  },
  reset(){previousPosition=null;}
 };
}

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

/** C++ Ship Core guidance; the runtime maps its velocity target into bounded propulsion actuation. */
export function createShipLandingAutopilot(shipKernel){
 let active=false,targetId=null;
 return {
  arm(site){if(!site||typeof site.id!=='string'||!site.id)return false;targetId=site.id;active=true;return true;},
  update(state){
   if(!active||!state)return null;
   const surfaceNormal=normalize(state.surfaceNormal);
   const relativePosition=vector3(state.positionMeters)&&vector3(state.targetPositionMeters)
    ?state.positionMeters.map((value,index)=>value-state.targetPositionMeters[index]):null;
   const altitude=surfaceNormal&&relativePosition?dot(relativePosition,surfaceNormal):0;
   // Faster high-altitude approach, with a braking-distance ceiling for the
   // 18 m/s² landing controller; the final flare remains deliberately gentle.
   const adaptiveDescentSpeed=clamp(Math.sqrt(Math.max(0,altitude-5)*36),1.5,40);
   const guidance=shipKernel?.calculateLandingGuidanceMeters?.({
    position:state.positionMeters,velocity:state.velocityMetersPerSecond,targetPosition:state.targetPositionMeters,
    surfaceNormal:state.surfaceNormal,shipForward:state.shipForwardLocal,shipUp:state.shipUpLocal,targetNorth:state.targetNorthLocal,
    maximumDescentSpeed:state.maximumDescentSpeed??adaptiveDescentSpeed,lateralGain:state.lateralGain??0.08,verticalGain:state.verticalGain??0.15
   });
   return guidance?{...guidance,targetId,authority:'closed-loop-actuation',actuationEnabled:true,
    coordinateFrame:state.coordinateFrame??'earth-local-tangent',telemetrySource:state.source,scaleValidation:state.scaleValidation}:null;
  },
  cancel(){active=false;targetId=null;},
  snapshot(){return {active,targetId,authority:active?'closed-loop-actuation':'standby',actuationEnabled:active};}
 };
}

export function isLandingEnvelopeSatisfied({altitudeUnits,lateralErrorUnits,speedUnitsPerSecond,maximumSlopeDeg,maximumLateralErrorUnits=3,maximumTouchdownSpeed=0.5,maximumSlopeAllowedDeg=5}){
 return [altitudeUnits,lateralErrorUnits,speedUnitsPerSecond,maximumSlopeDeg].every(Number.isFinite)&&altitudeUnits>=0&&altitudeUnits<=0.5&&lateralErrorUnits<=maximumLateralErrorUnits&&speedUnitsPerSecond<=maximumTouchdownSpeed&&maximumSlopeDeg<=maximumSlopeAllowedDeg;
}
