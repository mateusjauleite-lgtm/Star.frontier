import test from 'node:test';
import assert from 'node:assert/strict';
import {createShipFlightKernel} from './shipFlightKernel.js';
import {EARTH_LANDING_SITES,getLandingSite} from './landingSites.js';
import {calculateLandingGuidance,calculateLandingOrientation,createShipLandingAutopilot,createShipLandingTelemetryAdapter,createShipLandingMetricTelemetryAdapter,geodeticToEarthLocalFrame,isLandingEnvelopeSatisfied} from './landingAutopilot.js';
import {resolveFlightCommand} from './flightControlContract.js';

test('Earth gravity points toward the center in the JS fallback',()=>{
 const k=createShipFlightKernel(),a=k.gravityAcceleration([7000000,0,0]);
 assert.ok(a[0]<0);assert.equal(a[1],0);assert.equal(a[2],0);
 assert.ok(Math.abs(a[0]+8.1347)<0.01);assert.equal(k.backend,'javascript-fallback');
});
test('velocity-Verlet advances an orbital state with finite values',()=>{
 const k=createShipFlightKernel(),r=7000000,mu=k.earthGravitationalParameter,v=Math.sqrt(mu/r);
 const next=k.integrateOrbitStep([r,0,0],[0,v,0],mu,1);
 assert.ok(next);assert.ok(next.position[0]<r);assert.ok(next.position[1]>0);assert.ok(next.velocity[0]<0);
});
test('orbital kernel rejects zero radius and invalid time step',()=>{
 const k=createShipFlightKernel();assert.equal(k.gravityAcceleration([0,0,0]),null);
 assert.equal(k.integrateOrbitStep([1,0,0],[0,1,0],undefined,0),null);
});
test('Ship Core computes landing guidance in SI units and prioritizes lateral alignment',()=>{
 const k=createShipFlightKernel();
 const g=k.calculateLandingGuidanceMeters({
  position:[20,100,0],velocity:[0,0,0],targetPosition:[0,0,0],surfaceNormal:[0,1,0]
 });
 assert.ok(g);assert.equal(g.phase,'align');
 assert.ok(g.desiredVelocityMetersPerSecond[0]<0);
 assert.ok(g.desiredVelocityMetersPerSecond[1]<0);
 assert.equal(g.altitudeMeters,100);
});
test('Ship Core landing guidance damps lateral velocity and limits descent speed',()=>{
 const k=createShipFlightKernel();
 const g=k.calculateLandingGuidanceMeters({
  position:[0,50,0],velocity:[4,-20,0],targetPosition:[0,0,0],surfaceNormal:[0,1,0],
  maximumDescentSpeed:1.2
 });
 assert.ok(g);assert.equal(g.phase,'descent');
 assert.ok(g.desiredVelocityMetersPerSecond[0]<0);
 assert.ok(g.desiredVelocityMetersPerSecond[1]>=-1.2);
});
test('Ship Core landing guidance rejects invalid SI vectors',()=>{
 const k=createShipFlightKernel();
 assert.equal(k.calculateLandingGuidanceMeters({
  position:[0,0,0],targetPosition:[0,0,0],surfaceNormal:[0,0,0]
 }),null);
});
test('Ship landing autopilot orchestrates the C++ guidance interface without movement authority',()=>{
 const kernel=createShipFlightKernel();
 const autopilot=createShipLandingAutopilot(kernel);
 const site=getLandingSite('earth-salar-test-candidate');
 assert.equal(autopilot.arm(site),true);
 const result=autopilot.update({
  positionMeters:[0,100,0],velocityMetersPerSecond:[0,0,0],
  targetPositionMeters:[0,0,0],surfaceNormal:[0,1,0]
 });
 assert.equal(result.phase,'approach');
 assert.equal(result.targetId,site.id);
 assert.equal(result.authority,'guidance-only');
 autopilot.cancel();assert.equal(autopilot.snapshot().active,false);
});

test('live ship telemetry converts relative position, velocity and attitude into local SI coordinates',()=>{
 const adapter=createShipLandingTelemetryAdapter({metersPerRenderUnit:10});
 const first=adapter.sample({shipPositionWorld:[1,5,3],targetPositionWorld:[0,0,0],dt:0.1,
  eastWorld:[1,0,0],upWorld:[0,1,0],northWorld:[0,0,1],
  shipForwardWorld:[0,0,1],shipUpWorld:[0,1,0]});
 assert.deepEqual(first.positionMeters,[10,50,30]);
 assert.deepEqual(first.velocityMetersPerSecond,[0,0,0]);
 const second=adapter.sample({shipPositionWorld:[2,6,3],targetPositionWorld:[0,0.5,0],dt:0.5,
  eastWorld:[1,0,0],upWorld:[0,1,0],northWorld:[0,0,1],
  shipForwardWorld:[1,0,0],shipUpWorld:[0,1,0]});
 assert.deepEqual(second.velocityMetersPerSecond,[20,10,0]);
 assert.deepEqual(second.shipForwardLocal,[1,0,0]);
 assert.equal(second.actuationEnabled,false);
});
test('telemetry adapter rejects invalid and non-orthogonal local frames',()=>{
 const adapter=createShipLandingTelemetryAdapter({metersPerRenderUnit:1});
 assert.equal(adapter.sample({}),null);
 assert.equal(adapter.sample({shipPositionWorld:[0,1,0],targetPositionWorld:[0,0,0],dt:0.1,
  eastWorld:[1,0,0],upWorld:[1,0,0],northWorld:[0,0,1],
  shipForwardWorld:[0,0,1],shipUpWorld:[0,1,0]}),null);
});


test('metric landing frame maps all four ship feet into the platform metre frame',()=>{
 const adapter=createShipLandingMetricTelemetryAdapter();
 const feet=[
  {id:'port-fore',point:[-18,-23.18,-30]},
  {id:'starboard-fore',point:[18,-23.18,-30]},
  {id:'port-aft',point:[-18,-23.18,30]},
  {id:'starboard-aft',point:[18,-23.18,30]}
 ];
 const sample=adapter.sample({
  shipOriginPlatformLocalMeters:[0,23.94,0],
  shipRotationRelativeToPlatform:[0,0,0,1],contactPoints:feet,dt:0.1
 });
 assert.ok(sample);
 assert.equal(sample.coordinateFrame,'platform-local-metric');
 assert.deepEqual(sample.positionMeters,[0,23.94,0]);
 assert.deepEqual(sample.shipForwardLocal,[0,0,1]);
 assert.deepEqual(sample.shipUpLocal,[0,1,0]);
 assert.equal(sample.contactPointsMeters.length,4);
 assert.ok(sample.contactPointsMeters.every(p=>Math.abs(p.clearanceMeters)<1e-9));
 assert.ok(sample.allGearInsideDeck);
 assert.ok(Math.abs(sample.minimumGearClearanceMeters)<1e-9);
});
test('metric landing frame derives relative velocity and rotates the four feet with ship attitude',()=>{
 const adapter=createShipLandingMetricTelemetryAdapter();
 const feet=[
  {id:'port-fore',point:[-18,-23.18,-30]},
  {id:'starboard-fore',point:[18,-23.18,-30]},
  {id:'port-aft',point:[-18,-23.18,30]},
  {id:'starboard-aft',point:[18,-23.18,30]}
 ];
 adapter.sample({shipOriginPlatformLocalMeters:[0,23.94,0],shipRotationRelativeToPlatform:[0,0,0,1],contactPoints:feet,dt:0.1});
 const rotated=adapter.sample({
  shipOriginPlatformLocalMeters:[1,24.94,0],
  shipRotationRelativeToPlatform:[0,Math.SQRT1_2,0,Math.SQRT1_2],
  contactPoints:feet,dt:0.5
 });
 assert.deepEqual(rotated.velocityMetersPerSecond,[2,2,0]);
 assert.ok(Math.abs(rotated.contactPointsMeters[0].positionMeters[0]+29)<1e-9);
 assert.equal(rotated.actuationEnabled,false);
});
test('metric landing frame rejects invalid quaternion or missing one of the four feet',()=>{
 const adapter=createShipLandingMetricTelemetryAdapter();
 const feet=Array.from({length:4},(_,i)=>({id:String(i),point:[0,-23.18,0]}));
 assert.equal(adapter.sample({shipOriginPlatformLocalMeters:[0,0,0],shipRotationRelativeToPlatform:[0,0,0],contactPoints:feet,dt:0.1}),null);
 assert.equal(adapter.sample({shipOriginPlatformLocalMeters:[0,0,0],shipRotationRelativeToPlatform:[0,0,0,1],contactPoints:feet.slice(0,3),dt:0.1}),null);
});

test('Uyuni landing site uses the surveyed UY04 WGS84 reference and remains a candidate',()=>{
 const site=getLandingSite('earth-salar-test-candidate');assert.equal(site.status,'candidate');
 assert.equal(site.requiresTerrainValidation,true);assert.equal(site.requiresPadPlacement,true);
 assert.equal(EARTH_LANDING_SITES.length,1);
 assert.equal(site.latitudeDeg,-20.211888829);
 assert.equal(site.longitudeDeg,-67.422529683);
 assert.equal(site.coordinateReference,'WGS84');
 assert.equal(site.referencePointId,'UY04');
 assert.equal(site.referenceElevationMeters,3697.2995);
 assert.equal(site.landingHeadingTrueDeg,0);
});
test('geodetic coordinates use the Earth mesh axis convention and true-north tangent',()=>{
 const frame=geodeticToEarthLocalFrame({
  longitudeDeg:-67.422529683,latitudeDeg:-20.211888829,radiusUnits:600,elevationUnits:0.35
 });
 assert.ok(frame);
 assert.ok(Math.abs(Math.hypot(...frame.position)-600.35)<1e-9);
 const dot=frame.north.reduce((sum,v,i)=>sum+v*frame.up[i],0);
 assert.ok(Math.abs(dot)<1e-12);
 assert.ok(Math.abs(Math.hypot(...frame.north)-1)<1e-12);
 assert.equal(geodeticToEarthLocalFrame({longitudeDeg:0,latitudeDeg:91,radiusUnits:600}),null);
});
test('landing orientation aligns ship forward with true north on a level surface',()=>{
 const o=calculateLandingOrientation({surfaceNormal:[0,1,0],northReference:[0,0,-1],headingDeg:0});
 assert.ok(o);
 assert.deepEqual(o.forward.map(v=>Math.round(v*1e6)/1e6),[0,0,-1]);
 assert.deepEqual(o.right.map(v=>Math.round(v*1e6)/1e6),[1,0,0]);
 assert.deepEqual(o.up,[0,1,0]);
});
test('landing orientation applies clockwise heading from true north',()=>{
 const o=calculateLandingOrientation({surfaceNormal:[0,1,0],northReference:[0,0,-1],headingDeg:90});
 assert.ok(o);
 assert.deepEqual(o.forward.map(v=>Math.round(v*1e6)/1e6),[1,0,0]);
});
test('landing guidance aligns laterally before descent',()=>{
 const g=calculateLandingGuidance({currentPosition:[20,100,0],targetPosition:[0,0,0],surfaceNormal:[0,1,0]});
 assert.equal(g.phase,'align');assert.ok(g.desiredVelocity[0]<0);assert.ok(g.desiredVelocity[1]<0);
});
test('touchdown envelope rejects high speed or excessive slope',()=>{
 assert.equal(isLandingEnvelopeSatisfied({altitudeUnits:0.2,lateralErrorUnits:1,speedUnitsPerSecond:0.2,maximumSlopeDeg:2}),true);
 assert.equal(isLandingEnvelopeSatisfied({altitudeUnits:0.2,lateralErrorUnits:1,speedUnitsPerSecond:4,maximumSlopeDeg:2}),false);
});
test('manual control overrides automatic guidance',()=>{
 const r=resolveFlightCommand({automaticCommand:{x:0,y:-0.5,z:0.2},manualCommand:{x:0.1,y:0,z:0}});
 assert.equal(r.source,'manual');assert.equal(r.cancelAutopilot,true);
});
test('automatic control is available when manual input is absent',()=>{
 const r=resolveFlightCommand({automaticCommand:{x:0,y:-0.5,z:0.2}});
 assert.equal(r.source,'automatic');assert.equal(r.cancelAutopilot,false);
});
