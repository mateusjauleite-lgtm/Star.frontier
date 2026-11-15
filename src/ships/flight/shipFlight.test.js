import test from 'node:test';
import assert from 'node:assert/strict';
import {createShipFlightKernel} from './shipFlightKernel.js';
import {EARTH_LANDING_SITES,getLandingSite} from './landingSites.js';
import {calculateLandingGuidance,isLandingEnvelopeSatisfied} from './landingAutopilot.js';
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
test('landing location is a candidate and is not approved for landing',()=>{
 const site=getLandingSite('earth-salar-test-candidate');assert.equal(site.status,'candidate');
 assert.equal(site.requiresTerrainValidation,true);assert.equal(site.requiresPadPlacement,true);
 assert.equal(EARTH_LANDING_SITES.length,1);
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
