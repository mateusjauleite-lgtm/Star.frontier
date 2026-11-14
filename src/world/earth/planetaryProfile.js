/**
 * Physical Earth reference profile, separated from the Three.js render scale.
 * Values are metadata/configuration only; this does not simulate geophysics.
 */
export const EARTH_PLANETARY_PROFILE = Object.freeze({
  id: 'earth',
  displayName: 'TERRA',
  physical: Object.freeze({
    meanRadiusKm: 6371.0088,
    equatorialRadiusKm: 6378.137,
    polarRadiusKm: 6356.7523142,
    standardGravityMps2: 9.80665
  }),
  atmosphere: Object.freeze({
    referenceHeightKm: 100,
    rayleighScaleHeightKm: 8,
    note: 'Initial reference values for atmospheric visualization; validate against the chosen planet mesh and target visual profile.'
  })
});

export function createEarthPlanetaryProfile({ visualRadiusUnits = 300 } = {}) {
  const safeVisualRadius = Number.isFinite(visualRadiusUnits) && visualRadiusUnits > 0
    ? visualRadiusUnits
    : 300;
  const visualUnitsPerKm = safeVisualRadius / EARTH_PLANETARY_PROFILE.physical.meanRadiusKm;

  return Object.freeze({
    ...EARTH_PLANETARY_PROFILE,
    render: Object.freeze({
      visualRadiusUnits: safeVisualRadius,
      visualUnitsPerKm,
      scalePolicy: 'physical-kilometres-remain-independent-from-render-units'
    }),
    conversion: Object.freeze({
      kmToVisualUnits: km => Number.isFinite(km) ? km * visualUnitsPerKm : null,
      visualUnitsToKm: units => Number.isFinite(units) ? units / visualUnitsPerKm : null
    })
  });
}
