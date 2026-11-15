const ETOPO_MAGIC = 'ETOPO22\0';
const ETOPO_HEADER_BYTES = 56;
const ETOPO_DATA_PATH = 'earth/data/etopo2022-global-0.25deg.bin';

export const ETOPO_2022_GLOBAL_GRID = Object.freeze({
  source: 'NOAA ETOPO 2022 60 arc-second global relief, sampled to a 0.25-degree grid through NOAA ERDDAP',
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

/**
 * Load the compact NOAA-derived asset and report its state to the runtime.
 * A missing/invalid optional asset keeps the procedural fallback, but is no
 * longer silent: callers can expose the exact reason in diagnostics.
 */
export async function loadEtopo2022GlobalGrid({
  fetchImpl = globalThis.fetch,
  url = null,
  onStatus = null
} = {}) {
  const report = status => {
    try { onStatus?.(status); } catch {}
  };
  if (typeof fetchImpl !== 'function') {
    const status = { state: 'unavailable', reason: 'fetch-api-unavailable' };
    report(status);
    return null;
  }

  const base = import.meta.env?.BASE_URL ?? './';
  const assetUrl = url ?? new URL(
    `${base}${ETOPO_DATA_PATH}`,
    globalThis.location?.href ?? 'http://localhost/'
  ).href;
  report({ state: 'loading', url: assetUrl });

  try {
    const response = await fetchImpl(assetUrl);
    if (!response?.ok) {
      const status = {
        state: 'missing',
        reason: 'http-error',
        httpStatus: response?.status ?? null,
        url: assetUrl
      };
      report(status);
      return null;
    }

    const buffer = await response.arrayBuffer();
    const grid = parseEtopo2022Grid(buffer);
    if (!grid) {
      const status = {
        state: 'invalid',
        reason: 'invalid-binary-format-or-size',
        byteLength: buffer?.byteLength ?? null,
        url: assetUrl
      };
      report(status);
      return null;
    }

    report({
      state: 'ready',
      url: assetUrl,
      width: grid.width,
      height: grid.height,
      packagedResolutionDegrees: grid.packagedResolutionDegrees,
      verticalDatum: grid.verticalDatum
    });
    return grid;
  } catch (error) {
    report({
      state: 'error',
      reason: 'fetch-or-decode-failed',
      message: error instanceof Error ? error.message : String(error),
      url: assetUrl
    });
    return null;
  }
}
