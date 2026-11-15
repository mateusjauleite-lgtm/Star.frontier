import test from 'node:test';
import assert from 'node:assert/strict';
import {createShipFlightKernel} from './shipFlightKernel.js';
import {EARTH_LANDING_SITES,getLandingSite} from './landingSites.js';
import {calculateLandingGuidance,calculateLandingOrientation,geodeticToEarthLocalFrame,isLandingEnvelopeSatisfied} from './landingAutopilot.js';
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