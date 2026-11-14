/** Contract for the independent ocean rendering layer. */
export const EARTH_OCEANS_MODULE = Object.freeze({
  id: 'oceans', label: 'Oceanos', domain: 'oceans',
  status: 'preview', enabledByDefault: true, dependsOn: ['surface'],
  referenceScopes: ['oceans', 'global-imagery'],
  baselineTarget: 'modular-earth-oceans',
  responsibilities: ['ocean-sheen', 'water-material', 'coastal-transition'],
  implementation: './runtime/oceans.js'
});
