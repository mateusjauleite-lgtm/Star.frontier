import * as THREE from 'three';
import { createEarthLandMask } from './surface.js';
import { createEarthKernelAdapter, loadEarthKernel } from '../../wasm/earthKernel.js';
import { loadEtopo2022GlobalGrid } from '../../references/etopo2022.js';

const clamp01 = value => THREE.MathUtils.clamp(value, 0, 1);
const smoothstep = (a, b, value) => {
  const t = clamp01((value - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Global elevation grid contract:
 * { width, height, values: Float32Array, noDataValue?, units: 'meters',
 *   source, attribution, west=-180, east=180, south=-90, north=90 }
 * Rows are north-to-south; columns west-to-east. ETOPO/GEBCO adapters can
 * populate this contract without changing the Earth renderer.
 */
export function sampleEarthElevationGrid(grid, longitudeDeg, latitudeDeg) {
  if (!grid || !(grid.values instanceof Float32Array) ||
      !Number.isInteger(grid.width) || !Number.isInteger(grid.height) ||
      grid.width < 2 || grid.height < 2 ||
      grid.values.length < grid.width * grid.height) return null;

  const west = grid.west ?? -180;
  const east = grid.east ?? 180;
  const south = grid.south ?? -90;
  const north = grid.north ?? 90;
  const u = THREE.MathUtils.clamp((longitudeDeg - west) / (east - west), 0, 1) * (grid.width - 1);
  const v = THREE.MathUtils.clamp((north - latitudeDeg) / (north - south), 0, 1) * (grid.height - 1);
  const x0 = Math.floor(u), y0 = Math.floor(v);
  const x1 = Math.min(grid.width - 1, x0 + 1), y1 = Math.min(grid.height - 1, y0 + 1);
  const tx = u - x0, ty = v - y0;
  const at = (x, y) => grid.values[y * grid.width + x];
  const values = [at(x0,y0), at(x1,y0), at(x0,y1), at(x1,y1)];
  const weights = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
  const valid = value => Number.isFinite(value) &&
    (grid.noDataValue === undefined || value !== grid.noDataValue);
  if (values.some((value, index) => weights[index] > 0 && !valid(value))) return null;
  return values.reduce((sum, value, index) =>
    sum + (weights[index] ? value * weights[index] : 0), 0);
}

function proceduralFallback(longitude, latitude, radius, land) {
  const continentalShape =
    Math.sin(longitude * 2.35 + Math.sin(latitude * 3.7) * .72) *
    Math.cos(latitude * 5.4 - longitude * .86);
  const plateau = Math.max(0, continentalShape * .5 + .5);
  const plainVariation =
    Math.sin(longitude * 13.1 + Math.sin(latitude * 8.2)) *
    Math.cos(latitude * 17.3 - longitude * 3.1);
  const tectonicWave =
    Math.sin(longitude * 5.1 + Math.sin(latitude * 7.4) * 1.35) *
    Math.cos(latitude * 9.2 - longitude * 1.8);
  const mountainBelt = Math.pow(Math.max(0, 1 - Math.abs(tectonicWave)), 3.2);
  const highland = Math.pow(Math.max(0, plateau - .58), 1.7);
  const oceanWave =
    Math.sin(longitude * 4.3 + Math.sin(latitude * 2.8)) *
    Math.cos(latitude * 6.1 - longitude * 1.4);
  const oceanBasin = Math.pow(Math.max(0, 1 - Math.abs(oceanWave)), 4);

  const continental = radius * (
    .0012 + plateau * .0022 + mountainBelt * .014 +
    highland * .004 + plainVariation * .00035
  );
  const oceanic = -radius * (.006 + oceanBasin * .004 + Math.abs(oceanWave) * .001);
  return THREE.MathUtils.lerp(oceanic, continental, land);
}

export function createTerrainRuntime({ options, layers }) {
  let maskCanvas, maskData;
  let elevationSampler = null;
  let earthKernel = createEarthKernelAdapter();
  let heightScale = 1;
  let disposed = false;

  return {
    initialize() {
      const surface = layers.surface;
      if (!surface?.geometry) return;

      maskCanvas = createEarthLandMask(2048, 1024);
      const context = maskCanvas.getContext('2d');
      maskData = context.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;

      let grid = options.elevationGrid ?? null;
      let gridIsReady = grid?.values instanceof Float32Array;
      const exaggeration = Math.max(1, options.terrainVerticalExaggeration ?? 8);
      const radius = options.radius;
      const lodGeometries = surface.userData?.earthLodGeometries ?? [surface.geometry];
      const direction = new THREE.Vector3();
      const width = maskCanvas.width, height = maskCanvas.height;
      const unitsPerKm = radius / 6371.0088;
      heightScale = exaggeration;

      // Displace every prepared LOD mesh from the same elevation source so
      // switching detail levels never replaces real terrain with a smooth sphere.
      for (const geometry of lodGeometries) {
        const positions = geometry.attributes.position;
        const uv = geometry.attributes.uv;
        for (let i = 0; i < positions.count; i++) {
          const u = uv.getX(i), v = uv.getY(i);
          const px = Math.min(width - 1, Math.max(0, Math.floor(u * (width - 1))));
          const py = Math.min(height - 1, Math.max(0, Math.floor((1 - v) * (height - 1))));
          const land = smoothstep(.08, .92, maskData[(py * width + px) * 4] / 255);

          direction.fromBufferAttribute(positions, i).normalize();
          const latitude = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1));
          const longitude = Math.atan2(direction.z, direction.x);
          const latitudeDeg = THREE.MathUtils.radToDeg(latitude);
          const longitudeDeg = THREE.MathUtils.radToDeg(longitude);

          let elevationUnits = null;
          if (gridIsReady) {
            const elevationMeters = sampleEarthElevationGrid(grid, longitudeDeg, latitudeDeg);
            if (elevationMeters !== null) {
              elevationUnits = (elevationMeters / 1000) * unitsPerKm * exaggeration;
            }
          }
          if (elevationUnits === null) {
            elevationUnits = proceduralFallback(longitude, latitude, radius, land);
          }

          const finalRadius = radius + elevationUnits;
          positions.setXYZ(i, direction.x * finalRadius, direction.y * finalRadius, direction.z * finalRadius);
        }
        positions.needsUpdate = true;
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
      }
      const positions = surface.geometry.attributes.position;

      elevationSampler = (longitudeDeg, latitudeDeg) => {
        if (gridIsReady) {
          // Point queries stay in JS to avoid copying the full global grid into WASM
          // for every character/collision sample; geometry batches still use C++.
          const meters = sampleEarthElevationGrid(grid, longitudeDeg, latitudeDeg);
          if (meters !== null) return earthKernel.elevationMetersToUnits(
            meters, radius, 6371.0088, exaggeration
          );
        }
        const lon = THREE.MathUtils.degToRad(longitudeDeg);
        const lat = THREE.MathUtils.degToRad(latitudeDeg);
        const u = (longitudeDeg + 180) / 360;
        const v = (90 - latitudeDeg) / 180;
        const px = Math.min(width - 1, Math.max(0, Math.floor(u * (width - 1))));
        const py = Math.min(height - 1, Math.max(0, Math.floor(v * (height - 1))));
        const land = smoothstep(.08, .92, maskData[(py * width + px) * 4] / 255);
        const baseUnits = proceduralFallback(lon, lat, radius, land);
        const detailMeters = earthKernel.proceduralDetailMeters(longitudeDeg, latitudeDeg, 2600);
        const detailUnits = detailMeters === null ? 0 :
          earthKernel.elevationMetersToUnits(detailMeters, radius, 6371.0088, exaggeration);
        return baseUnits + (land > .5 && detailUnits !== null ? detailUnits : 0);
      };

      layers.terrain = {
        integratedWith: 'surface',
        displacedVertices: positions.count,
        elevationSource: gridIsReady ? (grid.source ?? 'provided-global-grid') : 'procedural-fallback',
        sourceAttribution: grid?.attribution ?? null,
        sourceGridReady: gridIsReady,
        verticalExaggeration: exaggeration,
        computeBackend: earthKernel.backend,
        unitsPerKm,
        waterGeometry: false,
        sampleHeight: elevationSampler,
        // Stage 1 of planetary collision: query the exact same displaced
        // elevation source used by the visible terrain. Coordinates are in
        // Earth-local space; the caller applies the Earth group's world transform.
        collisionSurface: {
          source: gridIsReady ? (grid.source ?? 'provided-global-grid') : 'procedural-fallback',
          sharesVisualElevation: true,
          sample(longitudeDeg, latitudeDeg) {
            if (disposed || !elevationSampler ||
                !Number.isFinite(longitudeDeg) || !Number.isFinite(latitudeDeg) ||
                latitudeDeg < -90 || latitudeDeg > 90) return null;
            const elevationUnits = elevationSampler(longitudeDeg, latitudeDeg);
            if (!Number.isFinite(elevationUnits)) return null;
            const latitude = THREE.MathUtils.degToRad(latitudeDeg);
            const longitude = THREE.MathUtils.degToRad(longitudeDeg);
            const radiusAtPoint = radius + elevationUnits;
            const cosLatitude = Math.cos(latitude);
            return {
              longitudeDeg,
              latitudeDeg,
              elevationUnits,
              radiusUnits: radiusAtPoint,
              localPosition: new THREE.Vector3(
                Math.cos(longitude) * cosLatitude * radiusAtPoint,
                Math.sin(latitude) * radiusAtPoint,
                Math.sin(longitude) * cosLatitude * radiusAtPoint
              )
            };
          }
        }
      };

      // Load the compact NOAA-derived global grid after the safe procedural
      // first frame. The same ETOPO samples then replace the fallback on every
      // prepared LOD mesh and remain the source used by the collision sampler.
      if (!gridIsReady && options.loadEtopo !== false) {
        loadEtopo2022GlobalGrid().then(loadedGrid => {
          if (disposed || !loadedGrid) return;
          grid = loadedGrid;
          gridIsReady = true;
          const vertexDirection = new THREE.Vector3();
          for (const geometry of lodGeometries) {
            const geometryPositions = geometry.attributes.position;
            for (let i = 0; i < geometryPositions.count; i++) {
              vertexDirection.fromBufferAttribute(geometryPositions, i).normalize();
              const latitudeDeg = THREE.MathUtils.radToDeg(Math.asin(
                THREE.MathUtils.clamp(vertexDirection.y, -1, 1)
              ));
              const longitudeDeg = THREE.MathUtils.radToDeg(Math.atan2(
                vertexDirection.z, vertexDirection.x
              ));
              const meters = sampleEarthElevationGrid(grid, longitudeDeg, latitudeDeg);
              let elevationUnits;
              if (meters === null) {
                const lon = THREE.MathUtils.degToRad(longitudeDeg);
                const lat = THREE.MathUtils.degToRad(latitudeDeg);
                const u = (longitudeDeg + 180) / 360;
                const v = (90 - latitudeDeg) / 180;
                const px = Math.min(width - 1, Math.max(0, Math.floor(u * (width - 1))));
                const py = Math.min(height - 1, Math.max(0, Math.floor(v * (height - 1))));
                const land = smoothstep(.08, .92, maskData[(py * width + px) * 4] / 255);
                elevationUnits = proceduralFallback(lon, lat, radius, land);
              } else {
                elevationUnits = (meters / 1000) * unitsPerKm * exaggeration;
              }
              const finalRadius = radius + elevationUnits;
              geometryPositions.setXYZ(i, vertexDirection.x * finalRadius,
                vertexDirection.y * finalRadius, vertexDirection.z * finalRadius);
            }
            geometryPositions.needsUpdate = true;
            geometry.computeVertexNormals();
            geometry.computeBoundingSphere();
          }
          if (layers.terrain) {
            layers.terrain.elevationSource = grid.source;
            layers.terrain.sourceAttribution = grid.attribution;
            layers.terrain.sourceGridReady = true;
            layers.terrain.verticalDatum = grid.verticalDatum ?? 'unspecified';
            layers.terrain.gridResolutionArcSeconds = grid.resolutionArcSeconds ?? null;
            layers.terrain.collisionSurface.source = grid.source;
          }
        }).catch(() => {
          // The procedural surface remains available when the optional data asset is absent.
        });
      }

      // Re-run the vertex elevation pass through the compiled C++ kernel once
      // WebAssembly is ready. The first pass above remains a safe JS fallback.
      loadEarthKernel().then(kernel => {
        if (disposed) { kernel.dispose(); return; }
        earthKernel.dispose();
        earthKernel = kernel;
        if (layers.terrain) layers.terrain.computeBackend = kernel.backend;
        if (kernel.backend !== 'wasm-c++') return;

        const vertexDirection = new THREE.Vector3();
        for (const geometry of lodGeometries) {
          const geometryPositions = geometry.attributes.position;
          if (!gridIsReady) {
            for (let i = 0; i < geometryPositions.count; i++) {
              vertexDirection.fromBufferAttribute(geometryPositions, i).normalize();
              const latitudeDeg = THREE.MathUtils.radToDeg(Math.asin(
                THREE.MathUtils.clamp(vertexDirection.y, -1, 1)
              ));
              const longitudeDeg = THREE.MathUtils.radToDeg(Math.atan2(
                vertexDirection.z, vertexDirection.x
              ));
              const u = (longitudeDeg + 180) / 360;
              const v = (90 - latitudeDeg) / 180;
              const px = Math.min(width - 1, Math.max(0, Math.floor(u * (width - 1))));
              const py = Math.min(height - 1, Math.max(0, Math.floor(v * (height - 1))));
              const land = smoothstep(.08, .92, maskData[(py * width + px) * 4] / 255);
              const lon = THREE.MathUtils.degToRad(longitudeDeg);
              const lat = THREE.MathUtils.degToRad(latitudeDeg);
              const baseUnits = proceduralFallback(lon, lat, radius, land);
              const detailMeters = kernel.proceduralDetailMeters(longitudeDeg, latitudeDeg, 2600);
              const detailUnits = detailMeters === null ? 0 :
                kernel.elevationMetersToUnits(detailMeters, radius, 6371.0088, exaggeration);
              const finalRadius = radius + baseUnits + (land > .5 && detailUnits !== null ? detailUnits : 0);
              geometryPositions.setXYZ(i, vertexDirection.x * finalRadius,
                vertexDirection.y * finalRadius, vertexDirection.z * finalRadius);
            }
          } else {
            const longitudes = new Float32Array(geometryPositions.count);
            const latitudes = new Float32Array(geometryPositions.count);
            for (let i = 0; i < geometryPositions.count; i++) {
              vertexDirection.fromBufferAttribute(geometryPositions, i).normalize();
              latitudes[i] = THREE.MathUtils.radToDeg(Math.asin(
                THREE.MathUtils.clamp(vertexDirection.y, -1, 1)
              ));
              longitudes[i] = THREE.MathUtils.radToDeg(Math.atan2(
                vertexDirection.z, vertexDirection.x
              ));
            }
            const elevations = kernel.sampleElevationBatch(grid, longitudes, latitudes);
            if (!elevations) continue;
            for (let i = 0; i < geometryPositions.count; i++) {
              const meters = elevations[i];
              if (!Number.isFinite(meters)) continue;
              vertexDirection.fromBufferAttribute(geometryPositions, i).normalize();
              const elevation = kernel.elevationMetersToUnits(
                meters, radius, 6371.0088, exaggeration
              );
              if (elevation === null) continue;
              const finalRadius = radius + elevation;
              geometryPositions.setXYZ(i, vertexDirection.x * finalRadius,
                vertexDirection.y * finalRadius, vertexDirection.z * finalRadius);
            }
          }
          geometryPositions.needsUpdate = true;
          geometry.computeVertexNormals();
          geometry.computeBoundingSphere();
        }
      }).catch(() => {
        // Keep the already-generated JS terrain if WASM loading fails.
      });
    },
    update() {},
    dispose() {
      disposed = true;
      maskCanvas = null;
      maskData = null;
      elevationSampler = null;
      earthKernel.dispose();
    }
  };
}
