import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EARTH_REGIONAL_ENVIRONMENT_LAYER_TYPES,
  JAU_REGIONAL_ENVIRONMENT_PROFILE,
  isCoordinateInsideRegionalCoverage,
  validateRegionalEnvironmentDataset
} from './regionalEnvironment.js';

const jauCoverage = { west: -48.7, east: -48.4, south: -22.4, north: -22.2 };

test('Jaú profile is anchored to the BT-01 coordinates', () => {
  assert.equal(JAU_REGIONAL_ENVIRONMENT_PROFILE.bodyId, 'earth');
  assert.equal(JAU_REGIONAL_ENVIRONMENT_PROFILE.anchor.latitudeDeg, -22.2964);
  assert.equal(JAU_REGIONAL_ENVIRONMENT_PROFILE.anchor.longitudeDeg, -48.5570);
  assert.equal(JAU_REGIONAL_ENVIRONMENT_PROFILE.scope, 'regional');
  assert.equal(JAU_REGIONAL_ENVIRONMENT_PROFILE.dataState, 'profile-only');
});

test('regional contract lists the planned environment layers', () => {
  assert.deepEqual(EARTH_REGIONAL_ENVIRONMENT_LAYER_TYPES, ['elevation', 'land-cover', 'water-mask', 'albedo', 'roughness', 'normal', 'ambient-occlusion']);
});

test('coverage accepts Jaú anchor and rejects coordinates outside it', () => {
  assert.equal(isCoordinateInsideRegionalCoverage(-22.2964, -48.5570, jauCoverage), true);
  assert.equal(isCoordinateInsideRegionalCoverage(-23.5, -48.5570, jauCoverage), false);
  assert.equal(isCoordinateInsideRegionalCoverage(-22.2964, -48.8, jauCoverage), false);
});

test('dataset descriptor validates source metadata and Jaú coverage', () => {
  const descriptor = validateRegionalEnvironmentDataset({
    id: 'jau-land-cover-reference', layerType: 'land-cover', source: 'MapBiomas',
    attribution: 'MapBiomas', license: 'pending-review', spatialResolutionMeters: 30,
    coverage: jauCoverage, asset: null
  });
  assert.equal(descriptor.regionId, JAU_REGIONAL_ENVIRONMENT_PROFILE.id);
  assert.equal(descriptor.layerType, 'land-cover');
  assert.equal(descriptor.spatialResolutionMeters, 30);
  assert.equal(descriptor.status, 'descriptor-validated');
  assert.ok(Object.isFrozen(descriptor));
  assert.ok(Object.isFrozen(descriptor.coverage));
});

test('descriptor rejects unsupported layers, missing attribution and wrong coverage', () => {
  const base = { id: 'test', layerType: 'land-cover', source: 'test source', attribution: 'test attribution', coverage: jauCoverage };
  assert.throws(() => validateRegionalEnvironmentDataset({ ...base, layerType: 'weather' }), /Tipo de camada/);
  assert.throws(() => validateRegionalEnvironmentDataset({ ...base, attribution: '' }), /atribuição/);
  assert.throws(() => validateRegionalEnvironmentDataset({ ...base, coverage: { west: 0, east: 1, south: 0, north: 1 } }), /não inclui/);
  assert.throws(() => validateRegionalEnvironmentDataset({ ...base, spatialResolutionMeters: 0 }), /resolução espacial/);
});