/** Structural contract for elevation and terrain geometry. */
export const EARTH_TERRAIN_MODULE = Object.freeze({
  id: 'terrain',
  label: 'Relevo e elevação',
  domain: 'terrain',
  status: 'planned',
  enabledByDefault: false,
  dependsOn: ['surface'],
  referenceScopes: ['terrain-study', 'mountains', 'geographic-detail'],
  baselineTarget: 'legacy-surface-geometry',
  responsibilities: ['elevation-data', 'terrain-displacement', 'mountain-ranges'],
  implementation: 'pending'
});
