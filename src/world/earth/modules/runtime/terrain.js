import * as THREE from 'three';
import { createEarthLandMask } from './surface.js';
import { createEarthKernelAdapter, loadEarthKernel } from '../../wasm/earthKernel.js';
import { loadEtopo2022GlobalGrid } from '../../references/etopo2022.js';

const clamp01 = value => THREE.MathUtils.clamp(value, 0, 1);
const surfacePatchDispose = patch => {
  patch.parent?.remove(patch);
  patch.geometry?.dispose();
  patch.material?.dispose();
};
const smoothstep = (a, b, value) => {
  const t = clamp01((value - a) / (b - a));
  return t * t * (3 - 2 * t);
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

      maskCanvas = createEarthLandMask(2048, 1024);
      const context = maskCanvas.getContext('2d');
      maskData = context.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;

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
      const exaggeration = Math.max(1, options.terrainVerticalExaggeration ?? 8);
      const radius = options.radius;
      const lodGeometries = surface.userData?.earthLodGeometries ?? [surface.geometry];
      const direction = new THREE.Vector3();
      const width = maskCanvas.width, height = maskCanvas.height;
      const unitsPerKm = radius / 6371.0088;
      heightScale = exaggeration;

      // One authoritative elevation function feeds both the visible mesh and
      // the physical collision surface. This prevents ETOPO/no-data/fallback
      // differences between what is rendered and what the player or ship hits.
      elevationSampler = (longitudeDeg, latitudeDeg) => {
        if (!Number.isFinite(longitudeDeg) || !Number.isFinite(latitudeDeg) ||
            latitudeDeg < -90 || latitudeDeg > 90) return null;

        if (gridIsReady) {
          const meters = sampleEarthElevationGrid(grid, longitudeDeg, latitudeDeg);
          if (meters !== null) {
            return earthKernel.elevationMetersToUnits(
              meters, radius, 6371.0088, exaggeration
            );
          }
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

      const applyElevationToMeshes = () => {
        const vertexDirection = new THREE.Vector3();
        for (const geometry of lodGeometries) {
          const positions = geometry.attributes.position;
          const longitudes = new Float32Array(positions.count);
          const latitudes = new Float32Array(positions.count);
          for (let i = 0; i < positions.count; i++) {
            vertexDirection.fromBufferAttribute(positions, i).normalize();
            latitudes[i] = THREE.MathUtils.radToDeg(Math.asin(
              THREE.MathUtils.clamp(vertexDirection.y, -1, 1)
            ));
            longitudes[i] = THREE.MathUtils.radToDeg(Math.atan2(
              vertexDirection.z, vertexDirection.x
            ));
          }

          // One batched C++/WASM call samples the authoritative NOAA grid.
          // The JavaScript sampler remains the fallback for no-data cells and
          // for devices where the WASM module is unavailable.
          const sampledMeters = gridIsReady
            ? earthKernel.sampleElevationBatch(grid, longitudes, latitudes)
            : null;
          for (let i = 0; i < positions.count; i++) {
            let elevationUnits = Number.isFinite(sampledMeters?.[i])
              ? earthKernel.elevationMetersToUnits(
                sampledMeters[i], radius, 6371.0088, exaggeration
              )
              : elevationSampler(longitudes[i], latitudes[i]);
            if (!Number.isFinite(elevationUnits)) continue;
            vertexDirection.fromBufferAttribute(positions, i).normalize();
            const finalRadius = radius + elevationUnits;
            positions.setXYZ(i, vertexDirection.x * finalRadius,
              vertexDirection.y * finalRadius, vertexDirection.z * finalRadius);
          }
          positions.needsUpdate = true;
          geometry.computeVertexNormals();
          geometry.computeBoundingSphere();
        }
      };

      applyElevationToMeshes();
      const positions = surface.geometry.attributes.position;

      layers.terrain = {
        integratedWith: 'surface',
        displacedVertices: positions.count,
        elevationSource: gridIsReady ? (grid.source ?? 'provided-global-grid') : 'procedural-fallback',
        sourceAttribution: grid?.attribution ?? null,
        sourceGridReady: gridIsReady,
        etopoStatus: gridIsReady
          ? { state: 'ready', source: grid.source ?? 'provided-global-grid' }
          : options.loadEtopo === false
            ? { state: 'disabled', reason: 'load-disabled' }
            : { state: 'loading', source: 'procedural-fallback-active' },
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
            const angularSegments = Math.max(32, Math.ceil(divisions * Math.PI * 2));
            const positions = [];
            const uvs = [];
            const indices = [];
            const longitudes = [];
            const latitudes = [];
            const centerLatitude = THREE.MathUtils.degToRad(latitudeDeg);
            const centerLongitude = THREE.MathUtils.degToRad(longitudeDeg);
            const point = new THREE.Vector3();

            const appendPoint = (longitude, latitude) => {
              longitudes.push(longitude);
              latitudes.push(latitude);
              uvs.push((longitude + 180) / 360, (90 - latitude) / 180);
              return true;
            };

            if (!appendPoint(longitudeDeg, latitudeDeg)) return null;
            for (let ring = 1; ring <= divisions; ring++) {
              const angularDistance = (ring / divisions * safeRadiusKm) / 6371.0088;
              const sinCenter = Math.sin(centerLatitude);
              const cosCenter = Math.cos(centerLatitude);
              const sinDistance = Math.sin(angularDistance);
              const cosDistance = Math.cos(angularDistance);
              for (let segment = 0; segment < angularSegments; segment++) {
                const bearing = segment / angularSegments * Math.PI * 2;
                const latitude = Math.asin(THREE.MathUtils.clamp(
                  sinCenter * cosDistance + cosCenter * sinDistance * Math.cos(bearing),
                  -1, 1
                ));
                const longitude = centerLongitude + Math.atan2(
                  Math.sin(bearing) * sinDistance * cosCenter,
                  cosDistance - sinCenter * Math.sin(latitude)
                );
                const longitudeDegAtPoint = THREE.MathUtils.euclideanModulo(
                  THREE.MathUtils.radToDeg(longitude) + 180, 360
                ) - 180;
                if (!appendPoint(longitudeDegAtPoint, THREE.MathUtils.radToDeg(latitude))) {
                  return null;
                }
              }

              const outerStart = 1 + (ring - 1) * angularSegments;
              const innerStart = ring === 1 ? 0 : 1 + (ring - 2) * angularSegments;
              for (let segment = 0; segment < angularSegments; segment++) {
                const next = (segment + 1) % angularSegments;
                if (ring === 1) {
                  indices.push(0, outerStart + segment, outerStart + next);
                } else {
                  indices.push(
                    innerStart + segment, outerStart + segment, innerStart + next,
                    outerStart + segment, outerStart + next, innerStart + next
                  );
                }
              }
            }

            // Sample the complete regional disk in one batch, using the same
            // ETOPO grid path as the global LOD meshes. Fall back per point
            // only when a source cell is no-data or WASM allocation fails.
            const sampledMeters = gridIsReady
              ? earthKernel.sampleElevationBatch(
                grid, new Float32Array(longitudes), new Float32Array(latitudes)
              )
              : null;
            for (let i = 0; i < longitudes.length; i++) {
              const elevationUnits = Number.isFinite(sampledMeters?.[i])
                ? earthKernel.elevationMetersToUnits(
                  sampledMeters[i], radius, 6371.0088, exaggeration
                )
                : elevationSampler(longitudes[i], latitudes[i]);
              if (!Number.isFinite(elevationUnits)) return null;
              const latRad = THREE.MathUtils.degToRad(latitudes[i]);
              const lonRad = THREE.MathUtils.degToRad(longitudes[i]);
              const patchRadius = radius + elevationUnits + 0.025;
              point.set(
                Math.cos(lonRad) * Math.cos(latRad) * patchRadius,
                Math.sin(latRad) * patchRadius,
                Math.sin(lonRad) * Math.cos(latRad) * patchRadius
              );
              positions.push(point.x, point.y, point.z);
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            geometry.setIndex(indices);
            geometry.computeVertexNormals();
            geometry.computeBoundingSphere();
            const patchMaterial = surface.material.clone();
            patchMaterial.polygonOffset = true;
            patchMaterial.polygonOffsetFactor = -1;
            patchMaterial.polygonOffsetUnits = -1;
            const patch = new THREE.Mesh(geometry, patchMaterial);
            patch.name = 'Earth-Local-HighResolution-Patch';
            patch.userData.earthPatch = {
              longitudeDeg,
              latitudeDeg,
              radiusKm: safeRadiusKm,
              segments: divisions,
              angularSegments,
              shape: 'geodesic-disk',
              meshSpacingKm: safeRadiusKm / divisions,
              sourceGridSpacingKm: gridIsReady
                ? (grid.north - grid.south) / (grid.height - 1) * 111.195
                : 0.25 * 111.195,
              patchAreaDiameterKm: safeRadiusKm * 2,
              samplingFollowsEtopo: true,
              elevationSource: gridIsReady ? (grid.source ?? 'provided-global-grid') : 'procedural-fallback'
            };
            surface.add(patch);
            highResolutionPatches.add(patch);
            return patch;
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
              const movedKm = previous.angleTo(current) * 6371.0088;
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

      // Replace the procedural first frame with NOAA ETOPO data. Reusing
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
              console.warn('[Earth] NOAA ETOPO unavailable; procedural terrain remains active:', status);
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
      // ready. C++ accelerates the procedural detail calculation; it does not
      // introduce a second elevation path or a different collision surface.
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
    update() {},
    dispose() {
      disposed = true;
      for (const patch of highResolutionPatches) {
        surfacePatchDispose(patch);
      }
      highResolutionPatches.clear();
      activeHighResolutionPatch = null;
      lastPatchCenter = null;
      maskCanvas = null;
      maskData = null;
      elevationSampler = null;
      earthKernel.dispose();
    }
  };
}
