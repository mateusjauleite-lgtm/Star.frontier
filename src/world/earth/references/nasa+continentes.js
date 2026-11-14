/**
 * NASA Earth imagery and geography reference catalogue.
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
      id: 'blue-marble-2002-global-mosaic',
      title: 'The Blue Marble: true-color global imagery at 1 km resolution',
      url: 'https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/',
      study: ['global-albedo', 'coastlines', 'land-cover', 'sea-ice'],
      assetUse: 'review-item-credit-resolution-and-redistribution-terms'
    },
    {
      id: 'earth-observatory',
      title: 'Earth Observatory',
      url: 'https://earthobservatory.nasa.gov/',
      study: ['biomes', 'coastlines', 'land-cover', 'seasonal-change'],
      assetUse: 'verify-the-specific-item-license-and-attribution'
    },
    {
      id: 'nasa-worldview',
      title: 'NASA Worldview',
      url: 'https://worldview.earthdata.nasa.gov/',
      study: ['cloud-cover', 'sea-ice', 'atmospheric-layers', 'time-series'],
      assetUse: 'research-and-reviewed-static-data-only'
    }
  ],
  implementationBoundary: Object.freeze({
    advisoryOnly: true,
    autoGenerateGeometry: false,
    autoReplaceExistingSurface: false,
    requireReviewBeforeIntegration: true
  })
});
