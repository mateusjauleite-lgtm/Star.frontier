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
  }),
    conversion: Object.freeze({
      kmToVisualUnits: km => Number.isFinite(km) ? km * visualUnitsPerKm : null,
      visualUnitsToKm: units => Number.isFinite(units) ? units / visualUnitsPerKm : null
    })
  });
}
