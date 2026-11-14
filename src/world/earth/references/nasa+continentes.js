/**
 * NASA continent reference catalogue.
 * No downloads, embedded textures, generated meshes, or automatic replacement.
 */
export const NASA_CONTINENT_REFERENCES = Object.freeze({
  provider: 'NASA',
  collections: [
    {
      id: 'visible-earth-blue-marble',
      title: 'Blue Marble and global Earth imagery',
      url: 'https://visibleearth.nasa.gov/collection/1484/blue-marble',
      study: ['global-continent-shapes', 'ocean-color', 'cloud-patterns'],
      assetUse: 'verify-the-specific-item-license-and-attribution'
    },
    {
      id: 'earth-observatory',
      title: 'Earth Observatory',
      url: 'https://earthobservatory.nasa.gov/',
      study: ['biomes', 'coastlines', 'land-cover', 'seasonal-change'],
      assetUse: 'verify-the-specific-item-license-and-attribution'
    }
  ],
  implementationBoundary: Object.freeze({
    advisoryOnly: true,
    autoGenerateGeometry: false,
    autoReplaceExistingSurface: false,
    requireReviewBeforeIntegration: true
  })
});
