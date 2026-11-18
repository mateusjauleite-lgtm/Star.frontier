/**
 * Google Earth visual-reference catalogue.
 * This metadata is for observation and comparison only; it does not fetch,
 * capture, embed, or redistribute Google imagery or 3D data.
 */
export const GOOGLE_EARTH_REFERENCES = Object.freeze([
  {
    id: 'google-earth-global',
    title: 'Global surface and geographic context',
    url: 'https://earth.google.com/web/',
    focus: ['continents', 'coastlines', 'islands', 'large-scale geography'],
    targetModules: ['surface'],
    use: 'visual-comparison-only'
  },
  {
    id: 'google-earth-terrain',
    title: 'Terrain, elevation and mountain systems',
    url: 'https://earth.google.com/web/',
    focus: ['mountain ranges', 'valleys', 'plateaus', 'terrain transitions'],
    targetModules: ['terrain'],
    use: 'visual-comparison-only'
  },
  {
    id: 'google-earth-ocean-coasts',
    title: 'Coastal geography and ocean boundaries',
    url: 'https://earth.google.com/web/',
    focus: ['coastal outlines', 'islands', 'bays', 'ocean-land transitions'],
    targetModules: ['surface', 'oceans'],
    use: 'visual-comparison-only'
  }
]);

export const GOOGLE_EARTH_REFERENCE_POLICY = Object.freeze({
  providerTermsMustBeReviewed: true,
  screenshotsAnd3dDataMayBeReused: false,
  directRuntimeImport: false,
  purpose: 'visual-research-and-baseline-comparison'
});
