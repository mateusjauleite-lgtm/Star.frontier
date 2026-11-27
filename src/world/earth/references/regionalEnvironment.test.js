import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EARTH_REGIONAL_ENVIRONMENT_LAYER_TYPES,
  JAU_REGIONAL_ENVIRONMENT_PROFILE,
  getRegionalEnvironmentBounds,
  isCoordinateInsideRegionalCoverage,
  validateRegionalEnvironmentDataset
} from './regionalEnvironment.js';

const coverage = getRegionalEnvironmentBounds();

test('Jaú profile is anchored to the BT-01 transport coordinates', () => {
  assert.equal(JAU_REGIONAL_ENVIRONMENT_PROFILE.bodyId, 'earth');
  assert.equal(JAU_REGIONAL_ENVIRONMENT_PROFILE.anchor.latitudeDeg, -22.2964);
  assert.equal(JAU_REGIONAL_ENVIRONMENT_PROFILE.anchor.longitudeDeg, -48.5570);
  assert.equal(JAU_REGIONAL_ENVIRONMENT_PROFILE.initialRadiusKm, 5);
  assert.equal(JAU_REGIONAL_ENVIRONMENT_PROFILE.targetResolutionMeters, 10);
  assert.equal(JAU_REGIONAL_ENVIRONMENT_PROFILE.projectedCrs, 'EPSG:32722');
});

test('regional contract lists all planned environment layers', () => {
  assert.deepEqual(EARTH_REGIONAL_ENVIRONMENT_LAYER_TYPES, ['elevation', 'land-cover', 'water-mask', 'albedo', 'roughness', 'normal', 'ambient-occlusion']);
});

test('calculated test footprint contains BT-01 and extends around the anchor', () => {
  assert.equal(isCoordinateInsideRegionalCoverage(-22.2964, -48.5570, coverage), true);
  assert.ok(coverage.north > -22.2964 && coverage.south < -22.2964);
  assert.ok(coverage.east > -48.5570 && coverage.west < -48.5570);
});

test('coverage check rejects coordinates outside the regional footprint', () => {
  assert.equal(isCoordinateInsideRegionalCoverage(-22.50, -48.5570, coverage), false);
  assert.equal(isCoordinateInsideRegionalCoverage(-22.2964, -48.70, coverage), false);
});

test('dataset descriptor validates metadata and complete Jaú footprint coverage', () => {
  const descriptor = validateRegionalEnvironmentDataset({
    id: 'jau-worldcover-2021', layerType: 'land-cover', source: 'ESA WorldCover 2021 v200',
    attribution: '© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium',
    license: 'CC-BY-4.0', spatialResolutionMeters: 10, coverage, asset: null
  });
  assert.equal(descriptor.regionId, JAU_REGIONAL_ENVIRONMENT_PROFILE.id);
  assert.equal(descriptor.layerType, 'land-cover');
  assert.equal(descriptor.spatialResolutionMeters, 10);
  assert.equal(descriptor.status, 'descriptor-validated');
  assert.ok(Object.isFrozen(descriptor) && Object.isFrozen(descriptor.coverage));
});

test('descriptor rejects unsupported layers, missing attribution and incomplete footprint', () => {
  const base = { id: 'test', layerType: 'land-cover', source: 'test source', attribution: 'test attribution', coverage };
  assert.throws(() => validateRegionalEnvironmentDataset({ ...base, layerType: 'weather' }), /Tipo de camada/);
  assert.throws(() => validateRegionalEnvironmentDataset({ ...base, attribution: '' }), /atribuição/);
  assert.throws(() => validateRegionalEnvironmentDataset({ ...base, coverage: { west: -48.6, east: -48.5, south: -22.35, north: -22.25 } }), /toda a área/);
  assert.throws(() => validateRegionalEnvironmentDataset({ ...base, spatialResolutionMeters: 0 }), /resolução espacial/);
});