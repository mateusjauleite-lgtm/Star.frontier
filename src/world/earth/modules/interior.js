/** Contract for the independently rendered planetary interior. */
export const EARTH_INTERIOR_MODULE = Object.freeze({
  id: 'interior', label: 'Interior geológico', domain: 'interior',
  status: 'preview', enabledByDefault: true, dependsOn: [],
  referenceScopes: ['earth-interior', 'crust', 'mantle', 'outer-core', 'inner-core'],
  baselineTarget: 'modular-earth-interior',
  responsibilities: [
    'crust-boundary', 'mantle-boundary', 'outer-core-boundary',
    'inner-core-boundary', 'interior-visualization'
  ],
  implementation: './runtime/interior.js'
});
