/** Contract for the independent planetary lighting renderer. */
export const EARTH_LIGHTING_MODULE = Object.freeze({
  id: 'lighting', label: 'Iluminação planetária', domain: 'lighting',
  status: 'preview', enabledByDefault: true, dependsOn: ['atmosphere'],
  referenceScopes: ['surface', 'atmosphere'],
  baselineTarget: 'blue-marble-solar-lighting',
  responsibilities: ['directional-sunlight', 'ambient-night-fill', 'day-night-terminator'],
  implementation: './runtime/blueMarbleLighting.js'
});
