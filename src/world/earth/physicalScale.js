/**
 * Authoritative SI <-> Three.js render-space calibration for planetary scenes.
 *
 * Physical measurements stay in metres. Render-space units are derived from
 * the selected visual radius; consumers must use this adapter instead of
 * repeating radius ratios locally.
 */
export const EARTH_MEAN_RADIUS_METERS = 6_371_008.8;

const finitePositive = (value, fallback) =>
  Number.isFinite(value) && value > 0 ? value : fallback;

export function createPhysicalScale({
  physicalRadiusMeters = EARTH_MEAN_RADIUS_METERS,
  renderRadiusUnits = 600
} = {}) {
  const safePhysicalRadiusMeters = finitePositive(
    physicalRadiusMeters, EARTH_MEAN_RADIUS_METERS
  );
  const safeRenderRadiusUnits = finitePositive(renderRadiusUnits, 600);
  const renderUnitsPerMeter = safeRenderRadiusUnits / safePhysicalRadiusMeters;
  const metersPerRenderUnit = 1 / renderUnitsPerMeter;
  const renderUnitsPerKm = renderUnitsPerMeter * 1000;
  const physicalRadiusKm = safePhysicalRadiusMeters / 1000;

  const metersToRenderUnits = meters =>
    Number.isFinite(meters) ? meters * renderUnitsPerMeter : null;
  const renderUnitsToMeters = units =>
    Number.isFinite(units) ? units * metersPerRenderUnit : null;
  const kmToRenderUnits = km =>
    Number.isFinite(km) ? km * renderUnitsPerKm : null;
  const renderUnitsToKm = units =>
    Number.isFinite(units) ? units / renderUnitsPerKm : null;

  return Object.freeze({
    physicalRadiusMeters: safePhysicalRadiusMeters,
    physicalRadiusKm,
    renderRadiusUnits: safeRenderRadiusUnits,
    renderUnitsPerMeter,
    metersPerRenderUnit,
    renderUnitsPerKm,
    metersToRenderUnits,
    renderUnitsToMeters,
    kmToRenderUnits,
    renderUnitsToKm
  });
}
