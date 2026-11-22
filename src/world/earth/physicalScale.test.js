import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EARTH_MEAN_RADIUS_METERS,
  createPhysicalScale
} from './physicalScale.js';

test('Earth physical scale maps its SI mean radius to the configured render radius', () => {
  const scale = createPhysicalScale({ renderRadiusUnits: 600 });
  assert.equal(scale.physicalRadiusMeters, EARTH_MEAN_RADIUS_METERS);
  assert.equal(scale.renderRadiusUnits, 600);
  assert.ok(Math.abs(scale.metersToRenderUnits(EARTH_MEAN_RADIUS_METERS) - 600) < 1e-9);
  assert.ok(Math.abs(scale.renderUnitsToMeters(600) - EARTH_MEAN_RADIUS_METERS) < 1e-6);
});

test('physical scale round-trips metres, kilometres and render units', () => {
  const scale = createPhysicalScale({ renderRadiusUnits: 6000 });
  for (const meters of [0, 1, 100, 1500, 6_371_008.8]) {
    assert.ok(Math.abs(scale.renderUnitsToMeters(scale.metersToRenderUnits(meters)) - meters) < 1e-7);
  }
  assert.ok(Math.abs(scale.kmToRenderUnits(1) - 6000 / 6371.0088) < 1e-12);
  assert.ok(Math.abs(scale.renderUnitsToKm(scale.kmToRenderUnits(12.5)) - 12.5) < 1e-10);
});

test('invalid calibration inputs use safe Earth defaults', () => {
  const scale = createPhysicalScale({ physicalRadiusMeters: NaN, renderRadiusUnits: 0 });
  assert.equal(scale.physicalRadiusMeters, EARTH_MEAN_RADIUS_METERS);
  assert.equal(scale.renderRadiusUnits, 600);
  assert.equal(scale.metersToRenderUnits(Infinity), null);
});
