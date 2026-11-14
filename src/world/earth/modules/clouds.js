/** Contract for the independent cloud coverage renderer. */
export const EARTH_CLOUDS_MODULE = Object.freeze({
  id: 'clouds', label: 'Nuvens e cobertura', domain: 'clouds',
  status: 'preview', enabledByDefault: true, dependsOn: ['atmosphere'],
  referenceScopes: ['clouds', 'atmosphere'],
  baselineTarget: 'modular-earth-clouds',
  responsibilities: ['cloud-layers', 'cloud-motion', 'coverage-preview'],
  implementation: './runtime/clouds.js'
});
