/**
 * Regional environmental data contract for the Earth surface.
 *
 * Metadata and geographic coverage only; no runtime loading or rendering.
 */

export const EARTH_REGIONAL_ENVIRONMENT_LAYER_TYPES = Object.freeze([
  'elevation', 'land-cover', 'water-mask', 'albedo', 'roughness', 'normal', 'ambient-occlusion'
]);

export const JAU_REGIONAL_ENVIRONMENT_PROFILE = Object.freeze({
  id: 'earth-surface-jau-sp-br',
  bodyId: 'earth',
  regionName: 'Jaú, São Paulo, Brasil',
  anchor: Object.freeze({ latitudeDeg: -22.2964, longitudeDeg: -48.5570 }),
  scope: 'regional',
  dataState: 'profile-only'
});

const finite = value => Number.isFinite(Number(value));

export function isCoordinateInsideRegionalCoverage(latitudeDeg, longitudeDeg, coverage) {
  if (!finite(latitudeDeg) || !finite(longitudeDeg) || !coverage) return false;
  const { west, east, south, north } = coverage;
  if (![west, east, south, north].every(finite) || west < -180 || east > 180 ||
      south < -90 || north > 90 || west >= east || south >= north) return false;
  return longitudeDeg >= west && longitudeDeg <= east &&
    latitudeDeg >= south && latitudeDeg <= north;
}

/** Validates metadata and requires the dataset to cover the regional anchor. */
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
  if (!isCoordinateInsideRegionalCoverage(profile.anchor.latitudeDeg, profile.anchor.longitudeDeg, descriptor.coverage)) {
    throw new RangeError('A cobertura do conjunto não inclui a coordenada de referência da região.');
  }
  const resolution = descriptor.spatialResolutionMeters ?? null;
  if (resolution !== null && (!finite(resolution) || Number(resolution) <= 0)) {
    throw new TypeError('A resolução espacial deve ser positiva, em metros.');
  }
  return Object.freeze({
    id, regionId: profile.id, layerType, source, attribution,
    license: String(descriptor.license ?? 'unspecified'),
    spatialResolutionMeters: resolution === null ? null : Number(resolution),
    coverage: Object.freeze({ west: Number(descriptor.coverage.west), east: Number(descriptor.coverage.east), south: Number(descriptor.coverage.south), north: Number(descriptor.coverage.north) }),
    asset: descriptor.asset ? String(descriptor.asset) : null,
    status: 'descriptor-validated'
  });
}