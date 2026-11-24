import { createPhysicalScale } from '../earth/physicalScale.js';

export const MOON_PLANETARY_PROFILE = Object.freeze({
  id: 'moon',
  displayName: 'LUA',
  physical: Object.freeze({
    massKg: 7.342e22,
    meanRadiusMeters: 1_737_400,
    meanRadiusKm: 1_737.4,
    gravitationalParameterM3S2: 4.9048695e12,
    standardGravityMps2: 1.625,
    meanDistanceFromEarthMeters: 384_400_000
  }),
  rotation: Object.freeze({
    siderealPeriodSeconds: 27.321661 * 86400,
    synchronousWithOrbit: true,
    axialTiltDegrees: 6.68
  }),
  terrain: Object.freeze({
    source: 'deterministic-procedural-lunar-relief',
    verticalExaggeration: 1,
    collisionUsesRenderedHeight: true
  })
});

export function createMoonPlanetaryProfile({ visualRadiusUnits = MOON_PLANETARY_PROFILE.physical.meanRadiusMeters } = {}) {
  const physicalScale = createPhysicalScale({
    physicalRadiusMeters: MOON_PLANETARY_PROFILE.physical.meanRadiusMeters,
    renderRadiusUnits: visualRadiusUnits
  });
  return Object.freeze({
    ...MOON_PLANETARY_PROFILE,
    render: Object.freeze({
      visualRadiusUnits: physicalScale.renderRadiusUnits,
      visualUnitsPerMeter: physicalScale.renderUnitsPerMeter,
      metersPerVisualUnit: physicalScale.metersPerRenderUnit
    }),
    physicalScale
  });
}
