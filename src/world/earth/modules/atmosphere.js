/** Contract for the independent physical and visual atmosphere system. */
export const EARTH_ATMOSPHERE_MODULE = Object.freeze({
  id: 'atmosphere', label: 'Atmosfera em camadas', domain: 'atmosphere',
  status: 'preview', enabledByDefault: true, dependsOn: [],
  referenceScopes: ['atmosphere', 'earth-science', 'standard-atmosphere'],
  baselineTarget: 'modular-earth-atmosphere',
  responsibilities: [
    'troposphere', 'stratosphere', 'mesosphere', 'thermosphere', 'exosphere',
    'altitude-mapping', 'pressure-density-temperature-sampling', 'horizon-glow'
  ],
  implementation: './runtime/atmosphere.js',
  physicalModel: './atmosphereModel.js'
});
