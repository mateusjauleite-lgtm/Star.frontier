/** Structural contract for future Earth surface and continental rendering. */
export const EARTH_SURFACE_MODULE = Object.freeze({
  id: 'surface',
  label: 'Superfície e continentes',
  domain: 'surface',
  status: 'planned',
  enabledByDefault: false,
  dependsOn: [],
  referenceScopes: ['continents', 'surface', 'global-imagery'],
  baselineTarget: 'legacy-surface-texture',
  responsibilities: ['surface-materials', 'continental-meshes', 'coastlines'],
  implementation: 'pending'
});
