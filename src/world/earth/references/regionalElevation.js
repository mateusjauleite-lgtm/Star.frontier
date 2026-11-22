const DEFAULT_TERRARIUM_URL =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

export function terrariumTileCoordinate(longitudeDeg, latitudeDeg, zoom) {
  if (![longitudeDeg, latitudeDeg, zoom].every(Number.isFinite) ||
      !Number.isInteger(zoom) || zoom < 0 || zoom > 15) return null;
  const n = 2 ** zoom;
  const normalizedLongitude = ((longitudeDeg + 180) % 360 + 360) % 360 - 180;
  const latitude = Math.max(-85.05112878, Math.min(85.05112878, latitudeDeg));
  const latitudeRad = latitude * Math.PI / 180;
  const xFloat = ((normalizedLongitude + 180) / 360) * n;
  const yFloat = (1 - Math.asinh(Math.tan(latitudeRad)) / Math.PI) * .5 * n;
  const x = Math.min(n - 1, Math.max(0, Math.floor(xFloat)));
  const y = Math.min(n - 1, Math.max(0, Math.floor(yFloat)));
  return {
    z: zoom, x, y,
    pixelX: (xFloat - Math.floor(xFloat)) * 256,
    pixelY: (yFloat - Math.floor(yFloat)) * 256,
    key: `${zoom}/${x}/${y}`
  };
}

export function decodeTerrariumElevation(red, green, blue) {
  return red * 256 + green + blue / 256 - 32768;
}

export function sampleTerrariumTile(tile, pixelX, pixelY) {
  if (!tile?.values || !Number.isInteger(tile.width) || !Number.isInteger(tile.height)) return null;
  const x = Math.max(0, Math.min(tile.width - 1, pixelX));
  const y = Math.max(0, Math.min(tile.height - 1, pixelY));
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(tile.width - 1, x0 + 1), y1 = Math.min(tile.height - 1, y0 + 1);
  const tx = x - x0, ty = y - y0;
  const at = (px, py) => tile.values[py * tile.width + px];
  const a = at(x0, y0), b = at(x1, y0), c = at(x0, y1), d = at(x1, y1);
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

function createCanvas(width, height) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(width, height);
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  return null;
}

/** Terrarium RGB elevation tile provider (meter elevations, async and cached). */
export function createTerrariumElevationProvider({
  fetchImpl = globalThis.fetch,
  createImageBitmapImpl = globalThis.createImageBitmap,
  urlTemplate = DEFAULT_TERRARIUM_URL,
  maxCachedTiles = 96
} = {}) {
  const cache = new Map();
  const pending = new Map();
  let disposed = false;
  let requests = 0;
  let failures = 0;

  async function loadTile(z, x, y) {
    const key = `${z}/${x}/${y}`;
    if (cache.has(key)) {
      const tile = cache.get(key);
      cache.delete(key);
      cache.set(key, tile);
      return tile;
    }
    if (pending.has(key)) return pending.get(key);
    if (typeof fetchImpl !== 'function' || typeof createImageBitmapImpl !== 'function') return null;
    const promise = (async () => {
      requests++;
      const url = urlTemplate.replaceAll('{z}', z).replaceAll('{x}', x).replaceAll('{y}', y);
      const response = await fetchImpl(url);
      if (!response?.ok) throw new Error(`Terrarium tile HTTP ${response?.status ?? 'error'}`);
      const bitmap = await createImageBitmapImpl(await response.blob());
      const tileWidth = bitmap.width;
      const tileHeight = bitmap.height;
      const canvas = createCanvas(tileWidth, tileHeight);
      const context = canvas?.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas 2D is unavailable for DEM decoding.');
      context.drawImage(bitmap, 0, 0);
      const rgba = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      bitmap.close?.();
      const values = new Float32Array(tileWidth * tileHeight);
      for (let i = 0; i < values.length; i++) {
        const offset = i * 4;
        values[i] = decodeTerrariumElevation(rgba[offset], rgba[offset + 1], rgba[offset + 2]);
      }
      const tile = { width: tileWidth, height: tileHeight, values, source: 'AWS Terrain Tiles / Terrarium' };
      cache.set(key, tile);
      while (cache.size > maxCachedTiles) cache.delete(cache.keys().next().value);
      return tile;
    })().catch(error => {
      failures++;
      return null;
    }).finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  }

  return {
    async sampleBatch(points, { zoom = 12 } = {}) {
      if (disposed || !Array.isArray(points) || !points.length) return null;
      const coordinates = points.map(point =>
        terrariumTileCoordinate(point.longitudeDeg, point.latitudeDeg, zoom)
      );
      const unique = new Map();
      for (const coordinate of coordinates) {
        if (coordinate) unique.set(coordinate.key, coordinate);
      }
      const tiles = new Map();
      await Promise.all([...unique.values()].map(async coordinate => {
        tiles.set(coordinate.key, await loadTile(coordinate.z, coordinate.x, coordinate.y));
      }));
      if (disposed) return null;
      const result = new Float32Array(points.length);
      result.fill(Number.NaN);
      coordinates.forEach((coordinate, index) => {
        if (!coordinate) return;
        const tile = tiles.get(coordinate.key);
        if (!tile) return;
        const value = sampleTerrariumTile(tile, coordinate.pixelX, coordinate.pixelY);
        if (Number.isFinite(value)) result[index] = value;
      });
      return result;
    },
    getStatus() {
      return {
        source: 'AWS Terrain Tiles / Terrarium (Tilezen-derived elevation mosaic)',
        attribution: 'Tilezen / AWS Terrain Tiles; underlying elevation datasets and native resolution vary by region.',
        zoomDefault: 12,
        cachedTiles: cache.size,
        pendingTiles: pending.size,
        requests,
        failures
      };
    },
    dispose() {
      disposed = true;
      cache.clear();
      pending.clear();
    }
  };
}
