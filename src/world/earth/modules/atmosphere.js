/** Structural contract for atmospheric shells and scattering. */
export const EARTH_ATMOSPHERE_MODULE = Object.freeze({
  id: 'atmosphere',
  label: 'Atmosfera em camadas',
  domain: 'atmosphere',
  status: 'planned',
  enabledByDefault: false,
  dependsOn: [],
  referenceScopes: ['atmosphere', 'earth-science'],
  baselineTarget: 'legacy-atmosphere-shell',
  responsibilities: ['atmospheric-layers', 'scattering', 'horizon-glow'],
  implementation: 'pending'
});
