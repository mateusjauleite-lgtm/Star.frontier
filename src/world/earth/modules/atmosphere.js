/** Contract for the independent physical and visual atmosphere system. */
export const EARTH_ATMOSPHERE_MODULE = Object.freeze({
  id: 'atmosphere', label: 'Atmosfera azul visual e modelo físico', domain: 'atmosphere',
  status: 'preview', enabledByDefault: true, dependsOn: [],
  referenceScopes: ['atmosphere', 'earth-science', 'standard-atmosphere'],
  baselineTarget: 'blue-fresnel-atmosphere',
  responsibilities: [
    'troposphere', 'stratosphere', 'mesosphere', 'thermosphere', 'exosphere',
    'altitude-mapping', 'pressure-density-temperature-sampling', 'horizon-glow'
  ],
  implementation: './runtime/blueMarbleAtmosphere.js',
  physicalModel: './atmosphereModel.js'
});
