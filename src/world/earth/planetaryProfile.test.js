import test from 'node:test';
import assert from 'node:assert/strict';
import { EARTH_PLANETARY_PROFILE, createEarthPlanetaryProfile } from './planetaryProfile.js';

test('Earth physical radius is independent from visual radius', () => {
  const profile = createEarthPlanetaryProfile({ visualRadiusUnits: 300 });
  assert.equal(profile.physical.meanRadiusKm, 6371.0088);
  assert.equal(profile.render.visualRadiusUnits, 300);
  assert.ok(Math.abs(profile.conversion.kmToVisualUnits(6371.0088) - 300) < 1e-9);
});

test('Earth profile converts altitude without changing physical source values', () => {
  const profile = createEarthPlanetaryProfile({ visualRadiusUnits: 637.10088 });
  assert.equal(profile.conversion.kmToVisualUnits(10), 1);
  assert.equal(profile.conversion.visualUnitsToKm(1), 10);
  assert.equal(EARTH_PLANETARY_PROFILE.physical.meanRadiusKm, 6371.0088);
});

test('invalid visual radius falls back to the documented render default', () => {
  const profile = createEarthPlanetaryProfile({ visualRadiusUnits: 0 });
  assert.equal(profile.render.visualRadiusUnits, 300);
});
