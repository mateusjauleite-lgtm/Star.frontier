/** Contract for the independent terrain relief renderer. */
export const EARTH_TERRAIN_MODULE = Object.freeze({
  id: 'terrain', label: 'Relevo e elevação', domain: 'terrain',
  status: 'preview', enabledByDefault: true, dependsOn: ['surface'],
  referenceScopes: ['terrain-study', 'mountains', 'geographic-detail'],
  baselineTarget: 'modular-earth-terrain',
  responsibilities: ['procedural-relief-preview', 'elevation-data-ready-interface', 'mountain-ranges'],
  implementation: './runtime/terrain.js'
});
