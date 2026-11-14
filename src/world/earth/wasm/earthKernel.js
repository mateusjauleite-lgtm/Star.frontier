const finiteOrNull = value => Number.isFinite(value) ? value : null;

function sampleInJavaScript(grid, longitude, latitude) {
  if (!grid || !(grid.values instanceof Float32Array) ||
      !Number.isInteger(grid.width) || !Number.isInteger(grid.height) ||
      grid.width < 2 || grid.height < 2 ||
      grid.values.length < grid.width * grid.height) return null;

  const west = grid.west ?? -180, east = grid.east ?? 180;
  const south = grid.south ?? -90, north = grid.north ?? 90;
  if (!(east > west) || !(north > south)) return null;

  const u = Math.max(0, Math.min(1, (longitude - west) / (east - west))) * (grid.width - 1);
  const v = Math.max(0, Math.min(1, (north - latitude) / (north - south))) * (grid.height - 1);
  const x0 = Math.floor(u), y0 = Math.floor(v);
  const x1 = Math.min(grid.width - 1, x0 + 1), y1 = Math.min(grid.height - 1, y0 + 1);
  const tx = u - x0, ty = v - y0;
  const values = [
    grid.values[y0 * grid.width + x0], grid.values[y0 * grid.width + x1],
    grid.values[y1 * grid.width + x0], grid.values[y1 * grid.width + x1]
  ];
  const noData = grid.noDataValue;
  const valid = value => Number.isFinite(value) && (noData === undefined || value !== noData);
  const weights = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
  if (values.some((value, index) => weights[index] > 0 && !valid(value))) return null;
  return finiteOrNull(values.reduce((sum, value, index) =>
    sum + (weights[index] ? value * weights[index] : 0), 0));
}

export function createEarthKernelAdapter(module = null) {
  let disposed = false;
  return {
    backend: module ? 'wasm-c++' : 'javascript-fallback',
    sampleElevation(grid, longitude, latitude) {
      if (disposed) return null;
      if (!module) return sampleInJavaScript(grid, longitude, latitude);
      if (!grid || !(grid.values instanceof Float32Array) ||
          !Number.isInteger(grid.width) || !Number.isInteger(grid.height) ||
          grid.width < 2 || grid.height < 2 ||
          grid.values.length < grid.width * grid.height) return null;

      const bytes = grid.width * grid.height * Float32Array.BYTES_PER_ELEMENT;
      const pointer = module._malloc(bytes);
      if (!pointer) return null;
      try {
        module.HEAPF32.set(grid.values.subarray(0, grid.width * grid.height), pointer / 4);
        const result = module._earth_sample_bilinear(
          pointer, grid.width, grid.height, longitude, latitude,
          grid.west ?? -180, grid.east ?? 180, grid.south ?? -90, grid.north ?? 90,
          grid.noDataValue ?? NaN
        );
        return finiteOrNull(result);
      } finally {
        module._free(pointer);
      }
    },
    elevationMetersToUnits(meters, radius, meanRadiusKm, exaggeration) {
      if (disposed) return null;
      if (!module) return finiteOrNull((meters / 1000) * (radius / meanRadiusKm) * exaggeration);
      return finiteOrNull(module._earth_elevation_meters_to_units(
        meters, radius, meanRadiusKm, exaggeration
      ));
    },
    dispose() { disposed = true; }
  };
}

export async function loadEarthKernel() {
  const base = import.meta.env?.BASE_URL ?? './';
  const moduleUrl = new URL(`${base}earth/earthKernel.js`, globalThis.location?.href ?? 'http://localhost/');
  try {
    const imported = await import(/* @vite-ignore */ moduleUrl.href);
    const createModule = imported.default;
    if (typeof createModule !== 'function') throw new Error('WASM factory export is missing');
    const wasm = await createModule({
      locateFile: file => new URL(file, moduleUrl).href
    });
    return createEarthKernelAdapter(wasm);
  } catch {
    return createEarthKernelAdapter();
  }
}
