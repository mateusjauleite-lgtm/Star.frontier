/** Contract for the independent first-generation surface renderer. */
export const EARTH_SURFACE_MODULE = Object.freeze({
  id: 'surface', label: 'Superfície e continentes', domain: 'surface',
  status: 'preview', enabledByDefault: true, dependsOn: [],
  referenceScopes: ['continents', 'surface', 'global-imagery'],
  baselineTarget: 'modular-earth-surface',
  responsibilities: ['surface-materials', 'continental-mapping', 'coastlines'],
  implementation: './runtime/surface.js'
});
