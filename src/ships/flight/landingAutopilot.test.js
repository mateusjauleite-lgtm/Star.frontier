import test from 'node:test';
import assert from 'node:assert/strict';
import { createShipLandingAutopilot } from './landingAutopilot.js';

function createFixture() {
  let received = null;
  const kernel = {
    calculateLandingGuidanceMeters(args) {
      received = args;
      return {
        altitudeMeters: 0,
        lateralErrorMeters: 0,
        desiredVelocityMetersPerSecond: [0, 0, 0],
        phase: 'flare'
      };
    }
  };
  const autopilot = createShipLandingAutopilot(kernel);
  assert.equal(autopilot.arm({ id: 'test-site' }), true);
  const sample = (altitudeMeters) => autopilot.update({
    positionMeters: [0, 23.94 + altitudeMeters, 0],
    velocityMetersPerSecond: [0, 0, 0],
    targetPositionMeters: [0, 23.94, 0],
    surfaceNormal: [0, 1, 0],
    shipForwardLocal: [0, 0, 1],
    shipUpLocal: [0, 1, 0],
    targetNorthLocal: [0, 0, 1],
    source: 'test',
    coordinateFrame: 'platform-local-metric'
  });
  return { sample, received: () => received };
}

test('landing autopilot uses a faster capped descent speed at high altitude', () => {
  const fixture = createFixture();
  const guidance = fixture.sample(1000);
  assert.equal(fixture.received().maximumDescentSpeed, 40);
  assert.equal(guidance.actuationEnabled, true);
  assert.equal(guidance.authority, 'closed-loop-actuation');
});

test('landing autopilot reduces descent speed as it enters the flare', () => {
  const fixture = createFixture();
  fixture.sample(10);
  assert.ok(fixture.received().maximumDescentSpeed > 1.5);
  assert.ok(fixture.received().maximumDescentSpeed < 40);
  fixture.sample(2);
  assert.equal(fixture.received().maximumDescentSpeed, 1.5);
});
