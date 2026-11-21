import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrbitalFlightAuthority } from './orbitalFlightAuthority.js';

test('orbital authority remains telemetry-only until calibration and opt-in', () => {
  const authority = createOrbitalFlightAuthority();
  assert.equal(authority.snapshot().actuationEnabled, false);
  assert.equal(authority.snapshot().proposalEnabled, false);
  assert.equal(authority.setProposalEnabled(true), false);
  assert.equal(authority.proposeCorrection({
    gravityAccelerationMetersPerSecond2: [0, -9.8, 0],
    deltaSeconds: 0.016
  }), null);
});

test('orbital authority rejects calibration without sufficient measured validation', () => {
  const authority = createOrbitalFlightAuthority();
  assert.equal(authority.calibrate({
    worldUnitsPerMeter: 0.001,
    validationSamples: 2,
    maximumResidualMeters: 0.1
  }), false);
  assert.equal(authority.snapshot().calibrated, false);
  assert.equal(authority.setProposalEnabled(true), false);
});

test('calibrated orbital authority returns a bounded proposal without enabling actuation', () => {
  const authority = createOrbitalFlightAuthority();
  assert.equal(authority.calibrate({
    worldUnitsPerMeter: 0.001,
    validationSamples: 5,
    maximumResidualMeters: 0.5
  }), true);
  assert.equal(authority.setProposalEnabled(true, 0.05), true);

  const proposal = authority.proposeCorrection({
    gravityAccelerationMetersPerSecond2: [0, -9.8, 0],
    deltaSeconds: 0.04
  });
  assert.ok(proposal);
  assert.ok(Math.hypot(...proposal.deltaVelocityMetersPerSecond) <= 0.0200000001);
  assert.deepEqual(proposal.proposedDisplacementWorldUnits, [
    0,
    proposal.deltaVelocityMetersPerSecond[1] * 0.04 * 0.001,
    0
  ]);
  assert.equal(proposal.actuationEnabled, false);
  assert.equal(authority.snapshot().actuationEnabled, false);
});

test('orbital authority rejects unsafe frame times, vectors and blend values', () => {
  const authority = createOrbitalFlightAuthority();
  authority.calibrate({
    worldUnitsPerMeter: 0.001,
    validationSamples: 3,
    maximumResidualMeters: 1
  });
  authority.setProposalEnabled(true);

  assert.equal(authority.proposeCorrection({
    gravityAccelerationMetersPerSecond2: [0, 0, 0],
    deltaSeconds: 0.041
  }), null);
  assert.equal(authority.proposeCorrection({
    gravityAccelerationMetersPerSecond2: [0, NaN, 0],
    deltaSeconds: 0.016
  }), null);
  assert.equal(authority.proposeCorrection({
    gravityAccelerationMetersPerSecond2: [0, -9.8, 0],
    deltaSeconds: 0.016,
    blend: 0.2
  }), null);
});
