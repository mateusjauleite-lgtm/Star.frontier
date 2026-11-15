const ETOPO_MAGIC = 'ETOPO22\0';
const ETOPO_HEADER_BYTES = 56;
const ETOPO_DATA_PATH = 'earth/data/etopo2022-global-0.25deg.bin';

export const ETOPO_2022_GLOBAL_GRID = Object.freeze({
  source: 'NOAA ETOPO 2022 60 arc-second global relief, resampled to 0.25 degrees',
  attribution: 'NOAA National Centers for Environmental Information, ETOPO 2022, DOI: 10.25921/fd45-gt74',
  verticalDatum: 'EGM2008 geoid',
  resolutionArcSeconds: 900,
  width: 1440,
  height: 720,
  west: -179.875,
  east: 179.875,
  south: -89.875,
  north: 89.875,
  noDataValue: -32768
});

/**
 * Decode the compact Star Frontier ETOPO grid.
 * Binary layout: 56-byte little-endian header followed by row-major Int16
 * elevations, with rows ordered north-to-south and columns west-to-east.
 */
export function parseEtopo2022Grid(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < ETOPO_HEADER_BYTES) return null;
  const view = new DataView(buffer);
  const magic = Array.from(new Uint8Array(buffer, 0, 8), byte =>
    String.fromCharCode(byte)).join('');
  if (magic !== ETOPO_MAGIC) return null;

  const width = view.getUint32(8, true);
  const height = view.getUint32(12, true);
  const west = view.getFloat64(16, true);
  const east = view.getFloat64(24, true);
  const south = view.getFloat64(32, true);
  const north = view.getFloat64(40, true);
  const noDataValue = view.getInt16(48, true);
  const dataType = view.getUint16(50, true);
  const headerBytes = view.getUint32(52, true);
  const sampleCount = width * height;

  if (width < 2 || height < 2 || !Number.isSafeInteger(sampleCount) ||
      dataType !== 1 || headerBytes !== ETOPO_HEADER_BYTES ||
      buffer.byteLength !== headerBytes + sampleCount * 2 ||
      !(east > west) || !(north > south)) return null;

  const values = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    values[i] = view.getInt16(headerBytes + i * 2, true);
  }

  return {
    ...ETOPO_2022_GLOBAL_GRID,
    width, height, west, east, south, north, noDataValue,
    values,
    units: 'meters',
    registration: 'pixel-center',
    sourceResolutionArcSeconds: 60,
    packagedResolutionDegrees: (east - west) / (width - 1)
  };
}

/** Load the optional compact NOAA-derived asset; null keeps the safe fallback. */
export async function loadEtopo2022GlobalGrid({
  fetchImpl = globalThis.fetch,
  url = null
} = {}) {
  if (typeof fetchImpl !== 'function') return null;
  const base = import.meta.env?.BASE_URL ?? './';
  const assetUrl = url ?? new URL(
    `${base}${ETOPO_DATA_PATH}`,
    globalThis.location?.href ?? 'http://localhost/'
  ).href;

  try {
    const response = await fetchImpl(assetUrl);
    if (!response?.ok) return null;
    return parseEtopo2022Grid(await response.arrayBuffer());
  } catch {
    return null;
  }
}
