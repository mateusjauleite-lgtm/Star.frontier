/** Structural contract for cloud layers and cloud motion. */
export const EARTH_CLOUDS_MODULE = Object.freeze({
  id: 'clouds',
  label: 'Nuvens e cobertura',
  domain: 'clouds',
  status: 'planned',
  enabledByDefault: false,
  dependsOn: ['atmosphere'],
  referenceScopes: ['clouds', 'atmosphere'],
  baselineTarget: 'legacy-cloud-shell',
  responsibilities: ['cloud-layers', 'cloud-shadowing', 'cloud-motion'],
  implementation: 'pending'
});
