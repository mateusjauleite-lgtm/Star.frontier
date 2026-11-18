/** Contract for persistent Earth surface infrastructure and landing-site markers. */
export const EARTH_INFRASTRUCTURE_MODULE = Object.freeze({
  id: 'infrastructure', label: 'Infraestrutura de superfície', domain: 'surface-infrastructure',
  status: 'preview', enabledByDefault: true, dependsOn: ['terrain'],
  referenceScopes: ['landing-sites', 'surface-bases', 'surface-stations'],
  baselineTarget: 'earth-surface-infrastructure',
  responsibilities: ['persistent-geographic-marker', 'terrain-aligned-base', 'surface-facilities'],
  implementation: './runtime/infrastructure.js'
});
