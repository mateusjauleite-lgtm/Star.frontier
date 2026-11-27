/**
 * Regional environmental data contract for the Earth surface.
 * Data is prepared offline and loaded only inside the bounded test region.
 * This module does not alter terrain collision, gravity, transport or spawn.
 */

export const EARTH_REGIONAL_ENVIRONMENT_LAYER_TYPES = Object.freeze([
  'elevation', 'land-cover', 'water-mask', 'albedo', 'roughness', 'normal', 'ambient-occlusion'
]);

export const JAU_REGIONAL_ENVIRONMENT_PROFILE = Object.freeze({
  id: 'earth-surface-jau-sp-br',
  bodyId: 'earth',
  regionName: 'Jaú, São Paulo, Brasil',
  anchor: Object.freeze({ latitudeDeg: -22.2964, longitudeDeg: -48.5570 }),
  initialRadiusKm: 5,
  targetResolutionMeters: 10,
  projectedCrs: 'EPSG:32722',
  scope: 'regional',
  dataState: 'preparation-pipeline-ready'
});

const finite = value => Number.isFinite(Number(value));

/** Approximate local WGS84 bounds for a small area around the BT-01 anchor. */
export function getRegionalEnvironmentBounds(profile = JAU_REGIONAL_ENVIRONMENT_PROFILE) {
  const latitude = Number(profile?.anchor?.latitudeDeg);
  const longitude = Number(profile?.anchor?.longitudeDeg);
  const radiusKm = Number(profile?.initialRadiusKm);
  if (!finite(latitude) || !finite(longitude) || !finite(radiusKm) ||
      Math.abs(latitude) >= 89.5 || radiusKm <= 0 || radiusKm > 100) {
    throw new RangeError('Perfil regional inválido para calcular a área de cobertura.');
  }
  const latitudeDelta = radiusKm / 111.195;
  const longitudeDelta = radiusKm / (111.195 * Math.cos(latitude * Math.PI / 180));
  return Object.freeze({
    west: longitude - longitudeDelta, east: longitude + longitudeDelta,
    south: latitude - latitudeDelta, north: latitude + latitudeDelta
  });
}

export function isCoordinateInsideRegionalCoverage(latitudeDeg, longitudeDeg, coverage) {
  if (!finite(latitudeDeg) || !finite(longitudeDeg) || !coverage) return false;
  const { west, east, south, north } = coverage;
  if (![west, east, south, north].every(finite) || west < -180 || east > 180 ||
      south < -90 || north > 90 || west >= east || south >= north) return false;
  return longitudeDeg >= west && longitudeDeg <= east &&
    latitudeDeg >= south && latitudeDeg <= north;
}

function coverageContains(outer, inner) {
  return outer.west <= inner.west && outer.east >= inner.east &&
    outer.south <= inner.south && outer.north >= inner.north;
}

/** Validates source metadata and requires coverage of the complete Jaú test area. */
export function validateRegionalEnvironmentDataset(descriptor, profile = JAU_REGIONAL_ENVIRONMENT_PROFILE) {
  if (!descriptor || typeof descriptor !== 'object') {
    throw new TypeError('O conjunto geográfico precisa de um descritor.');
  }
  const id = String(descriptor.id ?? '').trim();
  const layerType = String(descriptor.layerType ?? '').trim();
  const source = String(descriptor.source ?? '').trim();
  const attribution = String(descriptor.attribution ?? '').trim();
  if (!id) throw new TypeError('O conjunto geográfico precisa de um ID.');
  if (!EARTH_REGIONAL_ENVIRONMENT_LAYER_TYPES.includes(layerType)) {
    throw new TypeError('Tipo de camada geográfica não suportado.');
  }
  if (!source) throw new TypeError('A origem dos dados precisa ser informada.');
  if (!attribution) throw new TypeError('A atribuição dos dados precisa ser informada.');
  const requiredCoverage = getRegionalEnvironmentBounds(profile);
  const coverage = descriptor.coverage;
  if (!coverage || ![coverage.west, coverage.east, coverage.south, coverage.north].every(finite) ||
      !coverageContains(coverage, requiredCoverage)) {
    throw new RangeError('A cobertura do conjunto não inclui toda a área de teste de Jaú.');
  }
  const resolution = descriptor.spatialResolutionMeters ?? null;
  if (resolution !== null && (!finite(resolution) || Number(resolution) <= 0)) {
    throw new TypeError('A resolução espacial deve ser positiva, em metros.');
  }
  return Object.freeze({
    id, regionId: profile.id, layerType, source, attribution,
    license: String(descriptor.license ?? 'unspecified'),
    spatialResolutionMeters: resolution === null ? null : Number(resolution),
    coverage: Object.freeze({ west: Number(coverage.west), east: Number(coverage.east), south: Number(coverage.south), north: Number(coverage.north) }),
    asset: descriptor.asset ? String(descriptor.asset) : null,
    status: 'descriptor-validated'
  });
}