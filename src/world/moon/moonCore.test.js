import test from 'node:test';
import assert from 'node:assert/strict';
import { MOON_PLANETARY_PROFILE, createMoonPlanetaryProfile } from './moonProfile.js';
import { sampleMoonElevationMeters } from './moonSurface.js';

test('Moon profile exposes independent physical mass, radius and gravitational parameter', () => {
  assert.equal(MOON_PLANETARY_PROFILE.id, 'moon');
  assert.equal(MOON_PLANETARY_PROFILE.physical.massKg, 7.342e22);
  assert.equal(MOON_PLANETARY_PROFILE.physical.meanRadiusMeters, 1_737_400);
  assert.ok(MOON_PLANETARY_PROFILE.physical.gravitationalParameterM3S2 > 0);
});

test('Moon profile derives its own SI/render calibration', () => {
  const profile = createMoonPlanetaryProfile({ visualRadiusUnits: 100 });
  assert.equal(profile.render.visualRadiusUnits, 100);
  assert.ok(Math.abs(profile.physicalScale.metersToRenderUnits(1_737_400) - 100) < 1e-9);
});

test('lunar terrain sampler is deterministic, finite and bounded', () => {
  const first = sampleMoonElevationMeters(12.5, -21.2);
  const second = sampleMoonElevationMeters(12.5, -21.2);
  assert.equal(first, second);
  assert.ok(Number.isFinite(first));
  assert.ok(first >= -1800 && first <= 1100);
  assert.equal(sampleMoonElevationMeters(0, 91), null);
});
