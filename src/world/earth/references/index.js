import { NASA_CONTINENT_REFERENCES } from './nasa+continentes.js';
import { GOOGLE_EARTH_REFERENCES, GOOGLE_EARTH_REFERENCE_POLICY } from './google-earth.js';
import { PLANETARY_SCIENCE_BASELINE } from '../../planetary/planetaryScience.js';

/**
 * Research inputs only. Sources cannot alter the stable Earth baseline.
 */
export const EARTH_REFERENCE_POLICY = Object.freeze({
  mode: 'advisory',
  autoApply: false,
  runtimeDependency: false,
  requireHumanReview: true,
  requireLicenseReview: true,
  preserveBaseline: true,
  changeRule: 'propose-review-implement-test'
});

export const EARTH_REFERENCE_SOURCES = Object.freeze([
  {
    id: 'planetary-science-baseline',
    provider: 'Star Frontier Planetary Science',
    scope: ['mass', 'radius', 'gravity', 'interior', 'geology', 'tectonics', 'atmosphere', 'climate', 'hydrology', 'planet-scale-rendering'],
    usage: 'shared-scientific-design-reference',
    catalogue: PLANETARY_SCIENCE_BASELINE
  },
  {
    id: 'planetary-science-reference',
    provider: 'Planetary Science Reference',
    url: './planetary-science.md',
    scope: ['scientific-consistency', 'geodynamics', 'climate', 'erosion', 'rendering-pipeline'],
    usage: 'research-and-validation-guidance'
  },
  {
    id: 'nasa-earth-observatory',
    provider: 'NASA Earth Observatory',
    url: 'https://earthobservatory.nasa.gov/',
    scope: ['continents', 'oceans', 'clouds', 'surface', 'earth-science'],
    usage: 'research-reference',
    attributionRequired: 'check-per-item',
    licenseReview: 'required-before-asset-use'
  },
  {
    id: 'nasa-visible-earth',
    provider: 'NASA Visible Earth',
    url: 'https://visibleearth.nasa.gov/',
    scope: ['global-imagery', 'continents', 'oceans', 'atmosphere'],
    usage: 'research-reference',
    attributionRequired: 'check-per-item',
    licenseReview: 'required-before-asset-use',
    catalogue: NASA_CONTINENT_REFERENCES
  },
  {
    id: 'noaa-etopo-2022',
    provider: 'NOAA National Centers for Environmental Information',
    url: 'https://www.ncei.noaa.gov/products/etopo-global-relief-model',
    scope: ['global-land-elevation', 'ocean-basin-bathymetry', 'shorelines', 'rocky-relief'],
    usage: 'scientific-topography-and-bathymetry-reference',
    attributionRequired: 'cite-dataset-when-derived',
    dataset: 'ETOPO 2022 15 Arc-Second Global Relief Model',
    doi: '10.25921/fd45-gt74',
    implementationNote: 'Runtime accepts a compact NOAA-derived global grid; run npm run prepare:earth:etopo to create the optional 0.25-degree asset. The 60-arc-second source is downsampled for the global baseline; local 15-arc-second tiles are a later high-detail stage.',
    runtimeAsset: 'public/earth/data/etopo2022-global-0.25deg.bin',
    verticalDatum: 'EGM2008 geoid',
    sourceResolution: '60 arc-seconds',
    packagedResolution: '0.25 degrees',
    doi: '10.25921/fd45-gt74'
  },
  {
    id: 'google-earth',
    provider: 'Google Earth',
    url: 'https://earth.google.com/',
    scope: ['terrain-study', 'mountains', 'coasts', 'geographic-detail', 'continents', 'islands'],
    usage: 'visual-research-only',
    attributionRequired: 'per-google-terms',
    licenseReview: 'required-before-capture-or-redistribution',
    catalogue: GOOGLE_EARTH_REFERENCES,
    policy: GOOGLE_EARTH_REFERENCE_POLICY
  }
]);
