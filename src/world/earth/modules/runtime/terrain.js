import * as THREE from 'three';
import { createEarthKernelAdapter, loadEarthKernel } from '../../wasm/earthKernel.js';
import { loadEtopo2022GlobalGrid } from '../../references/etopo2022.js';
import { createEarthRegionalSurfaceRuntime } from './regionalSurface.js';
import { createTerrariumElevationProvider } from '../../references/regionalElevation.js';

export const EARTH_DEFAULT_TERRAIN_VERTICAL_EXAGGERATION = 1;
export const EARTH_NO_DEM_FALLBACK_ELEVATION_METERS = 0;

const clamp01 = value => THREE.MathUtils.clamp(value, 0, 1);
const surfacePatchDispose = patch => {
  patch.parent?.remove(patch);
  patch.geometry?.dispose();
  patch.material?.dispose();
};
export function calculateEtopoPatchSegments(radiusKm, latitudeDeg, grid = null, maxSegments = 128) {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 ||
      !Number.isFinite(latitudeDeg) || !Number.isFinite(maxSegments)) return 8;
  const latitudeSpacingDegrees = grid?.height > 1 && Number.isFinite(grid.north) &&
    Number.isFinite(grid.south)
    ? (grid.north - grid.south) / (grid.height - 1)
    : 0.25;
  const latitudeSpacingKm = Math.max(1, latitudeSpacingDegrees * 111.195);
  const longitudeSpacingKm = latitudeSpacingKm *
    Math.max(0.1, Math.abs(Math.cos(THREE.MathUtils.degToRad(latitudeDeg))));
  const sourceSpacingKm = Math.min(latitudeSpacingKm, longitudeSpacingKm);
  return Math.round(THREE.MathUtils.clamp(
    Math.ceil(radiusKm / sourceSpacingKm), 8, maxSegments
  ));
}

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
  if (![west, east, south, north, longitudeDeg, latitudeDeg].every(Number.isFinite) ||
      !(east > west) || !(north > south)) return null;
  let x0, x1, tx;
  if (grid.wrapLongitude === true) {
    const period = grid.longitudePeriod ?? 360;
    if (!Number.isFinite(period) || period <= 0) return null;
    const offset = THREE.MathUtils.euclideanModulo(longitudeDeg - west, period);
    const u = offset / (period / grid.width);
    const base = Math.floor(u);
    x0 = base % grid.width;
    x1 = (x0 + 1) % grid.width;
    tx = u - base;
  } else {
    const u = THREE.MathUtils.clamp((longitudeDeg - west) / (east - west), 0, 1) * (grid.width - 1);
    x0 = Math.floor(u);
    x1 = Math.min(grid.width - 1, x0 + 1);
    tx = u - x0;
  }
  const v = THREE.MathUtils.clamp((north - latitudeDeg) / (north - south), 0, 1) * (grid.height - 1);
  const y0 = Math.floor(v), y1 = Math.min(grid.height - 1, y0 + 1);
  const ty = v - y0;
  const at = (x, y) => grid.values[y * grid.width + x];
  const values = [at(x0,y0), at(x1,y0), at(x0,y1), at(x1,y1)];
  const weights = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
  const valid = value => Number.isFinite(value) &&
    (grid.noDataValue === undefined || value !== grid.noDataValue);
  if (values.some((value, index) => weights[index] > 0 && !valid(value))) return null;
  return values.reduce((sum, value, index) =>
    sum + (weights[index] ? value * weights[index] : 0), 0);
}

export function createTerrainRuntime({ options, layers }) {
  let elevationSampler = null;
  let earthKernel = createEarthKernelAdapter();
  let heightScale = 1;
  let disposed = false;
  let regionalDemProvider = null;
  let regionalDemZoom = options.regionalDemZoom ?? 12;
  let regionalSurfaceRuntime = null;
  const highResolutionPatches = new Set();
  let activeHighResolutionPatch = null;
  let lastPatchCenter = null;
  const invalidateActiveHighResolutionPatch = () => {
    if (activeHighResolutionPatch) {
      surfacePatchDispose(activeHighResolutionPatch);
      highResolutionPatches.delete(activeHighResolutionPatch);
    }
    activeHighResolutionPatch = null;
    lastPatchCenter = null;
  };

  return {
    initialize() {
      const surface = layers.surface;
      if (!surface?.geometry) return;

      let grid = options.elevationGrid ?? null;
      let gridIsReady = Boolean(
        grid?.values instanceof Float32Array &&
        Number.isInteger(grid.width) && grid.width >= 2 &&
        Number.isInteger(grid.height) && grid.height >= 2 &&
        grid.values.length >= grid.width * grid.height &&
        [grid.west ?? -180, grid.east ?? 180, grid.south ?? -90, grid.north ?? 90]
          .every(Number.isFinite) &&
        (grid.east ?? 180) > (grid.west ?? -180) &&
        (grid.north ?? 90) > (grid.south ?? -90)
      );
      const exaggeration = Math.max(1, options.terrainVerticalExaggeration ?? EARTH_DEFAULT_TERRAIN_VERTICAL_EXAGGERATION);
      const radius = options.radius;
      const physicalScale = options.physicalScale;
      if (!physicalScale || typeof physicalScale.metersToRenderUnits !== 'function' ||
          typeof physicalScale.kmToRenderUnits !== 'function') {
        throw new TypeError('Earth terrain requires the authoritative SI/render physical scale.');
      }
      let elevationRevision = 0;
      const getLodGeometries = () => surface.userData?.earthLodGeometries ?? [surface.geometry];
      const yieldToFrame = () => new Promise(resolve => {
        if (typeof globalThis.requestAnimationFrame === 'function') {
          globalThis.requestAnimationFrame(() => resolve());
        } else {
          setTimeout(resolve, 0);
        }
      });
      const direction = new THREE.Vector3();
      const unitsPerKm = physicalScale.kmToRenderUnits(1);
      heightScale = exaggeration;

      // One authoritative elevation function feeds both the visible mesh and
      // the physical collision surface. This prevents ETOPO/no-data/fallback
      // differences between what is rendered and what the player or ship hits.
      elevationSampler = (longitudeDeg, latitudeDeg) => {
        if (!Number.isFinite(longitudeDeg) || !Number.isFinite(latitudeDeg) ||
            latitudeDeg < -90 || latitudeDeg > 90) return null;

        // The regional DEM cache is shared by rendering and collision. Until a
        // tile is decoded, ETOPO remains the immediate synchronous fallback.
        const regionalMeters = regionalDemProvider?.sampleCached?.(
          longitudeDeg, latitudeDeg, { zoom: regionalDemZoom }
        );
        if (Number.isFinite(regionalMeters)) {
          return physicalScale.metersToRenderUnits(regionalMeters) * exaggeration;
        }

        if (gridIsReady) {
          const meters = sampleEarthElevationGrid(grid, longitudeDeg, latitudeDeg);
          if (meters !== null) {
            return physicalScale.metersToRenderUnits(meters) * exaggeration;
          }
        }

        // Never invent geographic features when elevation data is unavailable.
        // Keep the reference sphere at zero elevation until ETOPO or a regional
        // DEM tile supplies a real measurement; rendering and collision share it.
        return physicalScale.metersToRenderUnits(
          EARTH_NO_DEM_FALLBACK_ELEVATION_METERS
        ) * exaggeration;
      };

      const applyElevationToMeshes = async () => {
        const revision = ++elevationRevision;
        const vertexDirection = new THREE.Vector3();
        const geometries = getLodGeometries();
        for (const geometry of geometries) {
          const positions = geometry.attributes.position;
          const longitudes = new Float32Array(positions.count);
          const latitudes = new Float32Array(positions.count);
          for (let i = 0; i < positions.count; i++) {
            if (disposed || revision !== elevationRevision) return false;
            vertexDirection.fromBufferAttribute(positions, i).normalize();
            latitudes[i] = THREE.MathUtils.radToDeg(Math.asin(
              THREE.MathUtils.clamp(vertexDirection.y, -1, 1)
            ));
            longitudes[i] = THREE.MathUtils.radToDeg(Math.atan2(
              vertexDirection.z, vertexDirection.x
            ));
            if (i > 0 && i % 4096 === 0) await yieldToFrame();
          }

          // Batch the NOAA samples once, then displace in short frame-sized
          // slices. This lets the first renderer frame appear before the
          // complete planetary mesh has finished processing.
          const sampledMeters = gridIsReady
            ? earthKernel.sampleElevationBatch(grid, longitudes, latitudes)
            : null;
          for (let i = 0; i < positions.count; i++) {
            if (disposed || revision !== elevationRevision) return false;
            const elevationUnits = Number.isFinite(sampledMeters?.[i])
              ? physicalScale.metersToRenderUnits(sampledMeters[i]) * exaggeration
              : elevationSampler(longitudes[i], latitudes[i]);
            if (Number.isFinite(elevationUnits)) {
              vertexDirection.fromBufferAttribute(positions, i).normalize();
              const finalRadius = radius + elevationUnits;
              positions.setXYZ(i, vertexDirection.x * finalRadius,
                vertexDirection.y * finalRadius, vertexDirection.z * finalRadius);
            }
            if (i > 0 && i % 4096 === 0) {
              positions.needsUpdate = true;
              await yieldToFrame();
            }
          }
          if (disposed || revision !== elevationRevision) return false;
          positions.needsUpdate = true;
          geometry.computeVertexNormals();
          geometry.computeBoundingSphere();
        }
        return true;
      };

      applyElevationToMeshes();
      const positions = surface.geometry.attributes.position;

      layers.terrain = {
        integratedWith: 'surface',
        displacedVertices: positions.count,
        lodLevel: surface.userData?.earthLodLevel ?? 0,
        elevationSource: gridIsReady ? (grid.source ?? 'provided-global-grid') : 'reference-sphere',
        sourceAttribution: grid?.attribution ?? null,
        sourceGridReady: gridIsReady,
        etopoStatus: gridIsReady
          ? { state: 'ready', source: grid.source ?? 'provided-global-grid' }
          : options.loadEtopo === false
            ? { state: 'disabled', reason: 'load-disabled' }
            : { state: 'loading', source: 'reference-sphere-active' },
        verticalExaggeration: exaggeration,
        visualVerticalExaggeration: exaggeration,
        computeBackend: earthKernel.backend,
        unitsPerKm,
        waterGeometry: false,
        sampleHeight: elevationSampler,
        // Stage 1 of planetary collision: query the exact same displaced
        // elevation source used by the visible terrain. Coordinates are in
        // Earth-local space; the caller applies the Earth group's world transform.
        collisionSurface: {
          source: gridIsReady ? (grid.source ?? 'provided-global-grid') : 'reference-sphere',
          sharesVisualElevation: true,
          // Build a local, high-resolution render patch from the same authoritative
          // sampler used by the global LOD mesh and physical point queries.
          // The patch is attached to the globe mesh, so axial tilt and rotation
          // are inherited without a second transform path.
          createHighResolutionPatch({
            longitudeDeg,
            latitudeDeg,
            radiusKm = 25,
            segments = null
          } = {}) {
            if (disposed || !elevationSampler ||
                !Number.isFinite(longitudeDeg) || !Number.isFinite(latitudeDeg) ||
                latitudeDeg < -89.5 || latitudeDeg > 89.5) return null;
            const safeRadiusKm = THREE.MathUtils.clamp(radiusKm, 1, 1000);
            const divisions = Number.isFinite(segments)
              ? Math.round(THREE.MathUtils.clamp(segments, 8, 128))
              : calculateEtopoPatchSegments(safeRadiusKm, latitudeDeg, gridIsReady ? grid : null);

            // Compatibility marker only: regional quadtree tiles now own the
            // visible surface. Avoid allocating a second invisible terrain mesh.
            const marker = new THREE.Object3D();
            marker.name = 'Earth-Regional-Collision-Activation';
            marker.visible = false;
            marker.userData.earthPatch = {
              longitudeDeg,
              latitudeDeg,
              radiusKm: safeRadiusKm,
              segments: divisions,
              shape: 'quadtree-activation-marker',
              elevationSource: gridIsReady ? (grid.source ?? 'provided-global-grid') : 'reference-sphere'
            };
            surface.add(marker);
            highResolutionPatches.add(marker);
            return marker;
          },

          updateHighResolutionPatch(worldPosition, {
            activationAltitudeUnits = 120,
            radiusKm = 750,
            segments = null,
            recenterDistanceKm = 80
          } = {}) {
            if (disposed || !worldPosition?.isVector3 || !surface.parent) return null;
            surface.updateWorldMatrix(true, false);
            const centerWorld = surface.getWorldPosition(new THREE.Vector3());
            const altitudeUnits = worldPosition.distanceTo(centerWorld) - radius;
            if (altitudeUnits > activationAltitudeUnits) {
              if (activeHighResolutionPatch) {
                surfacePatchDispose(activeHighResolutionPatch);
                highResolutionPatches.delete(activeHighResolutionPatch);
                activeHighResolutionPatch = null;
                lastPatchCenter = null;
              }
              return null;
            }

            const surfaceLocal = surface.worldToLocal(worldPosition.clone()).normalize();
            const latitudeDeg = THREE.MathUtils.radToDeg(Math.asin(
              THREE.MathUtils.clamp(surfaceLocal.y, -1, 1)
            ));
            const longitudeDeg = THREE.MathUtils.radToDeg(Math.atan2(
              surfaceLocal.z, surfaceLocal.x
            ));

            if (lastPatchCenter) {
              const previous = new THREE.Vector3(
                Math.cos(THREE.MathUtils.degToRad(lastPatchCenter.latitudeDeg)) *
                  Math.cos(THREE.MathUtils.degToRad(lastPatchCenter.longitudeDeg)),
                Math.sin(THREE.MathUtils.degToRad(lastPatchCenter.latitudeDeg)),
                Math.cos(THREE.MathUtils.degToRad(lastPatchCenter.latitudeDeg)) *
                  Math.sin(THREE.MathUtils.degToRad(lastPatchCenter.longitudeDeg))
              );
              const current = new THREE.Vector3(
                Math.cos(THREE.MathUtils.degToRad(latitudeDeg)) *
                  Math.cos(THREE.MathUtils.degToRad(longitudeDeg)),
                Math.sin(THREE.MathUtils.degToRad(latitudeDeg)),
                Math.cos(THREE.MathUtils.degToRad(latitudeDeg)) *
                  Math.sin(THREE.MathUtils.degToRad(longitudeDeg))
              );
              const movedKm = previous.angleTo(current) * physicalScale.physicalRadiusKm;
              if (movedKm < recenterDistanceKm) return activeHighResolutionPatch;
            }

            if (activeHighResolutionPatch) {
              surfacePatchDispose(activeHighResolutionPatch);
              highResolutionPatches.delete(activeHighResolutionPatch);
            }
            activeHighResolutionPatch = this.createHighResolutionPatch({
              longitudeDeg,
              latitudeDeg,
              radiusKm,
              segments
            });
            lastPatchCenter = activeHighResolutionPatch ? { longitudeDeg, latitudeDeg } : null;
            return activeHighResolutionPatch;
          },
          sampleWorldPosition(worldPosition) {
            if (disposed || !worldPosition?.isVector3 || !surface.parent) return null;
            surface.updateWorldMatrix(true, false);
            const surfaceLocal = surface.worldToLocal(worldPosition.clone()).normalize();
            const latitudeDeg = THREE.MathUtils.radToDeg(Math.asin(
              THREE.MathUtils.clamp(surfaceLocal.y, -1, 1)
            ));
            const longitudeDeg = THREE.MathUtils.radToDeg(Math.atan2(
              surfaceLocal.z, surfaceLocal.x
            ));
            const result = this.sample(longitudeDeg, latitudeDeg);
            if (!result) return null;
            surface.parent.updateWorldMatrix(true, false);
            const worldPositionOnSurface = result.localPosition.clone()
              .applyMatrix4(surface.parent.matrixWorld);
            const worldNormal = result.terrainNormal.clone()
              .transformDirection(surface.parent.matrixWorld);
            return {
              ...result,
              worldPosition: worldPositionOnSurface,
              worldNormal,
              altitudeUnits: worldPosition.distanceTo(worldPositionOnSurface)
            };
          },
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
            const localPosition = new THREE.Vector3(
              Math.cos(longitude) * cosLatitude * radiusAtPoint,
              Math.sin(latitude) * radiusAtPoint,
              Math.sin(longitude) * cosLatitude * radiusAtPoint
            );

            // Include the globe mesh rotation (including axial tilt) in the
            // collision point. The result remains local to the Earth group,
            // so the caller applies the Earth's world transform only once.
            surface.updateMatrix();
            localPosition.applyMatrix4(surface.matrix);
            // This is the radial up direction, not the terrain slope normal;
            // the latter will be derived from neighbouring height samples.
            const radialNormal = new THREE.Vector3(
              Math.cos(longitude) * cosLatitude,
              Math.sin(latitude),
              Math.sin(longitude) * cosLatitude
            ).transformDirection(surface.matrix);

            // Estimate the actual terrain normal from neighbouring elevations.
            // This includes slopes from ETOPO rather than assuming a perfect sphere.
            const pointAt = (lonDeg, latDeg) => {
              const heightUnits = elevationSampler(lonDeg, latDeg);
              if (!Number.isFinite(heightUnits)) return null;
              const latRad = THREE.MathUtils.degToRad(latDeg);
              const lonRad = THREE.MathUtils.degToRad(lonDeg);
              const pointRadius = radius + heightUnits;
              return new THREE.Vector3(
                Math.cos(lonRad) * Math.cos(latRad) * pointRadius,
                Math.sin(latRad) * pointRadius,
                Math.sin(lonRad) * Math.cos(latRad) * pointRadius
              ).applyMatrix4(surface.matrix);
            };
            const latitudeStep = 0.01;
            const longitudeStep = latitudeStep / Math.max(0.1, Math.abs(cosLatitude));
            const wrapLongitude = value =>
              THREE.MathUtils.euclideanModulo(value + 180, 360) - 180;
            const westPoint = pointAt(wrapLongitude(longitudeDeg - longitudeStep), latitudeDeg);
            const eastPoint = pointAt(wrapLongitude(longitudeDeg + longitudeStep), latitudeDeg);
            const southPoint = pointAt(longitudeDeg, Math.max(-90, latitudeDeg - latitudeStep));
            const northPoint = pointAt(longitudeDeg, Math.min(90, latitudeDeg + latitudeStep));
            let terrainNormal = radialNormal.clone();
            if (westPoint && eastPoint && southPoint && northPoint) {
              const eastTangent = eastPoint.sub(westPoint);
              const northTangent = northPoint.sub(southPoint);
              terrainNormal = northTangent.cross(eastTangent).normalize();
              if (terrainNormal.dot(radialNormal) < 0) terrainNormal.negate();
            }

            return {
              longitudeDeg,
              latitudeDeg,
              elevationUnits,
              radiusUnits: radiusAtPoint,
              localPosition,
              radialNormal,
              terrainNormal
            };
          }
        }
      };

      // Called by the surface runtime only when camera distance changes LOD.
      // The collision sampler is deliberately untouched: only the visible mesh
      // is replaced and displaced from the same authoritative elevation source.
      layers.terrain.refreshGeometry = () => {
        if (disposed) return false;
        layers.terrain.displacedVertices = surface.geometry?.attributes?.position?.count ?? 0;
        layers.terrain.lodLevel = surface.userData?.earthLodLevel ?? 0;
        applyElevationToMeshes();
        return true;
      };

      // Regional cube-sphere tiles replace the former single local high-res
      // patch as the scalable near-player surface. The global ETOPO grid remains
      // the fallback and the authoritative base for the collision sampler.
      regionalDemZoom = options.regionalDemZoom ?? 12;
      regionalDemProvider = createTerrariumElevationProvider({
        urlTemplate: options.regionalDemUrlTemplate ??
          'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
        maxCachedTiles: options.regionalDemCacheTiles ?? 96
      });
      regionalSurfaceRuntime = createEarthRegionalSurfaceRuntime({
        surface,
        radius,
        elevationSampler,
        sampleElevationMetersBatch: points => regionalDemProvider.sampleBatch(points, {
          zoom: regionalDemZoom
        }),
        elevationMetersToUnits: meters => physicalScale.metersToRenderUnits(meters) * exaggeration,
        maxLevel: options.regionalSurfaceMaxLevel ?? 12,
        maxTiles: options.regionalSurfaceMaxTiles ?? 48,
        segments: options.regionalSurfaceSegments ?? 24,
        buildPerUpdate: 2
      });
      layers.terrain.regionalSurface = regionalSurfaceRuntime.getStatus();
      layers.terrain.regionalDem = regionalDemProvider.getStatus();
      layers.terrain.syncSurfaceMaterials = () => regionalSurfaceRuntime.syncSurfaceMaterials();
      layers.terrain.prepareRegion = ({ latitudeDeg, longitudeDeg, altitudeMeters = 0 } = {}) => {
        if (disposed || !Number.isFinite(altitudeMeters) || altitudeMeters < 0) {
          return Promise.resolve({ ok: false, reason: 'terrain-runtime-unavailable' });
        }
        const altitudeUnits = physicalScale.metersToRenderUnits(altitudeMeters);
        return regionalSurfaceRuntime.prepareRegion({ latitudeDeg, longitudeDeg, altitudeUnits });
      };

      // Replace the reference-sphere first frame with NOAA ETOPO data. Reusing
      // applyElevationToMeshes also applies the identical no-data fallback
      // used by point queries from the collision surface.
      if (!gridIsReady && options.loadEtopo !== false) {
        loadEtopo2022GlobalGrid({
          url: options.etopoUrl ?? null,
          onStatus: status => {
            if (disposed || !layers.terrain) return;
            layers.terrain.etopoStatus = status;
            if (status.state === 'ready') {
              console.info('[Earth] NOAA ETOPO loaded:', status);
            } else if (status.state !== 'loading') {
              console.warn('[Earth] NOAA ETOPO unavailable; reference-radius terrain remains active:', status);
            }
          }
        }).then(loadedGrid => {
          if (disposed || !loadedGrid) return;
          grid = loadedGrid;
          gridIsReady = true;
          invalidateActiveHighResolutionPatch();
          applyElevationToMeshes();
          if (layers.terrain) {
            layers.terrain.elevationSource = grid.source;
            layers.terrain.sourceAttribution = grid.attribution;
            layers.terrain.sourceGridReady = true;
            layers.terrain.verticalDatum = grid.verticalDatum ?? 'unspecified';
            layers.terrain.gridResolutionArcSeconds = grid.resolutionArcSeconds ?? null;
            layers.terrain.etopoStatus = {
              state: 'ready',
              width: grid.width,
              height: grid.height,
              packagedResolutionDegrees: grid.packagedResolutionDegrees,
              verticalDatum: grid.verticalDatum ?? 'unspecified'
            };
            layers.terrain.collisionSurface.source = grid.source;
          }
        });
      }

      // Rebuild the visible meshes through the same sampler after WASM is
      // ready. C++ accelerates batch sampling; it does not introduce a second
      // elevation path or a different collision surface.
      loadEarthKernel().then(kernel => {
        if (disposed) { kernel.dispose(); return; }
        earthKernel.dispose();
        earthKernel = kernel;
        invalidateActiveHighResolutionPatch();
        if (layers.terrain) layers.terrain.computeBackend = kernel.backend;
        if (kernel.backend === 'wasm-c++') applyElevationToMeshes();
      }).catch(() => {
        // Keep the already-generated JS terrain if WASM loading fails.
      });
    },
    prepareRegion({ latitudeDeg, longitudeDeg, altitudeMeters = 0 } = {}) {
      if (disposed || !regionalSurfaceRuntime ||
          !Number.isFinite(altitudeMeters) || altitudeMeters < 0) {
        return Promise.resolve({ ok: false, reason: 'terrain-runtime-unavailable' });
      }
      const altitudeUnits = physicalScale.metersToRenderUnits(altitudeMeters);
      return regionalSurfaceRuntime.prepareRegion({ latitudeDeg, longitudeDeg, altitudeUnits });
    },
    update(delta, context) {
      regionalSurfaceRuntime?.update(delta, context);
      if (layers.terrain && regionalSurfaceRuntime) {
        layers.terrain.regionalSurface = regionalSurfaceRuntime.getStatus();
        layers.terrain.regionalDem = regionalDemProvider?.getStatus?.() ?? null;
      }
    },
    dispose() {
      disposed = true;
      regionalSurfaceRuntime?.dispose();
      regionalDemProvider?.dispose();
      for (const patch of highResolutionPatches) {
        surfacePatchDispose(patch);
      }
      highResolutionPatches.clear();
      activeHighResolutionPatch = null;
      lastPatchCenter = null;
      elevationSampler = null;
      earthKernel.dispose();
    }
  };
}
