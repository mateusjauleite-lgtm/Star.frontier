/** Structural contract for planetary day/night and illumination. */
export const EARTH_LIGHTING_MODULE = Object.freeze({
  id: 'lighting',
  label: 'Iluminação planetária',
  domain: 'lighting',
  status: 'planned',
  enabledByDefault: false,
  dependsOn: ['atmosphere'],
  referenceScopes: ['surface', 'atmosphere'],
  baselineTarget: 'legacy-earth-lighting',
  responsibilities: ['day-night-terminator', 'sun-angle', 'night-side'],
  implementation: 'pending'
});
