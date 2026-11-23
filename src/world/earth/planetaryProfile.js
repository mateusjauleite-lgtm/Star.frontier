import {
  EARTH_MEAN_RADIUS_METERS,
  createPhysicalScale
} from './physicalScale.js';

/**
 * Physical Earth reference profile. All measurements are SI; render-space
 * calibration is owned by physicalScale.js and never duplicated here.
 */
export const EARTH_PLANETARY_PROFILE = Object.freeze({
  id: 'earth',
  displayName: 'TERRA',
  physical: Object.freeze({
    meanRadiusMeters: EARTH_MEAN_RADIUS_METERS,
    meanRadiusKm: EARTH_MEAN_RADIUS_METERS / 1000,
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

export function createEarthPlanetaryProfile({ visualRadiusUnits = 600 } = {}) {
  const physicalScale = createPhysicalScale({
    physicalRadiusMeters: EARTH_PLANETARY_PROFILE.physical.meanRadiusMeters,
    renderRadiusUnits: visualRadiusUnits
  });

  return Object.freeze({
    ...EARTH_PLANETARY_PROFILE,
    render: Object.freeze({
      visualRadiusUnits: physicalScale.renderRadiusUnits,
      visualUnitsPerKm: physicalScale.renderUnitsPerKm,
      metersPerVisualUnit: physicalScale.metersPerRenderUnit,
      scalePolicy: 'single-si-to-render-space-calibration'
    }),
    physicalScale,
    conversion: Object.freeze({
      metersToVisualUnits: physicalScale.metersToRenderUnits,
      visualUnitsToMeters: physicalScale.renderUnitsToMeters,
      kmToVisualUnits: physicalScale.kmToRenderUnits,
      visualUnitsToKm: physicalScale.renderUnitsToKm,
      metersPerVisualUnit: physicalScale.metersPerRenderUnit,
      visualUnitsPerMeter: physicalScale.renderUnitsPerMeter
    })
  });
}
