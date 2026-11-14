/** Structural contract for ocean rendering and water detail. */
export const EARTH_OCEANS_MODULE = Object.freeze({
  id: 'oceans',
  label: 'Oceanos',
  domain: 'oceans',
  status: 'planned',
  enabledByDefault: false,
  dependsOn: ['surface'],
  referenceScopes: ['oceans', 'global-imagery'],
  baselineTarget: 'legacy-ocean-material',
  responsibilities: ['ocean-material', 'water-detail', 'coastal-transition'],
  implementation: 'pending'
});
