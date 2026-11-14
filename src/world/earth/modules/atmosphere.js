/** Contract for the independent atmospheric shell renderer. */
export const EARTH_ATMOSPHERE_MODULE = Object.freeze({
  id: 'atmosphere', label: 'Atmosfera em camadas', domain: 'atmosphere',
  status: 'preview', enabledByDefault: true, dependsOn: [],
  referenceScopes: ['atmosphere', 'earth-science'],
  baselineTarget: 'modular-earth-atmosphere',
  responsibilities: ['atmospheric-layers', 'rim-scattering-preview', 'horizon-glow'],
  implementation: './runtime/atmosphere.js'
});
