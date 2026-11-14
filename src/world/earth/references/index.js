import { NASA_CONTINENT_REFERENCES } from './nasa+continentes.js';

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
    id: 'google-earth',
    provider: 'Google Earth',
    url: 'https://earth.google.com/',
    scope: ['terrain-study', 'mountains', 'coasts', 'geographic-detail'],
    usage: 'visual-research-only',
    attributionRequired: 'per-google-terms',
    licenseReview: 'required-before-capture-or-redistribution'
  }
]);
