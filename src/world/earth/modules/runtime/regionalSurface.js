import * as THREE from 'three';

const FACE_MAP = Object.freeze([
  (u, v, out) => out.set(1, v, -u),
  (u, v, out) => out.set(-1, v, u),
  (u, v, out) => out.set(u, 1, -v),
  (u, v, out) => out.set(u, -1, v),
  (u, v, out) => out.set(u, v, 1),
  (u, v, out) => out.set(-u, v, -1)
]);

// SphereGeometry maps longitude 0° to u=0.5 and increases u toward negative longitude.
// Regional tiles must use the same convention to avoid mirrored imagery at handoff.
export function earthLongitudeToSphereUv(longitudeDeg) {
  if (!Number.isFinite(longitudeDeg)) return null;
  return THREE.MathUtils.euclideanModulo(0.5 - longitudeDeg / 360, 1);
}

export function earthCubeFaceDirection(face, u, v, target = new THREE.Vector3()) {
  const mapper = FACE_MAP[face];
  if (!mapper || !Number.isFinite(u) || !Number.isFinite(v)) return null;
  return mapper(u, v, target).normalize();
}

export function earthDirectionToLatLon(direction) {
  const normal = direction?.clone?.().normalize();
  if (!normal || !Number.isFinite(normal.x + normal.y + normal.z)) return null;
  return {
    longitudeDeg: THREE.MathUtils.radToDeg(Math.atan2(normal.z, normal.x)),
    latitudeDeg: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(normal.y, -1, 1)))
  };
}

/** Returns the quadtree tile containing a unit direction, independent of camera view. */
export function getEarthQuadtreeNodeForDirection(direction, level = 0) {
  if (!direction?.isVector3 || !Number.isInteger(level) || level < 0) return null;
  const normal = direction.clone().normalize();
  if (!Number.isFinite(normal.x + normal.y + normal.z) || normal.lengthSq() < 1e-10) return null;
  const ax = Math.abs(normal.x), ay = Math.abs(normal.y), az = Math.abs(normal.z);
  let face, u, v, denominator;
  if (ax >= ay && ax >= az) {
    denominator = ax;
    if (normal.x >= 0) { face = 0; u = -normal.z / denominator; v = normal.y / denominator; }
    else { face = 1; u = normal.z / denominator; v = normal.y / denominator; }
  } else if (ay >= ax && ay >= az) {
    denominator = ay;
    if (normal.y >= 0) { face = 2; u = normal.x / denominator; v = -normal.z / denominator; }
    else { face = 3; u = normal.x / denominator; v = normal.z / denominator; }
  } else {
    denominator = az;
    if (normal.z >= 0) { face = 4; u = normal.x / denominator; v = normal.y / denominator; }
    else { face = 5; u = -normal.x / denominator; v = normal.y / denominator; }
  }
  const divisions = 2 ** level;
  const x = Math.min(divisions - 1, Math.max(0, Math.floor((THREE.MathUtils.clamp(u, -1, 1) + 1) * .5 * divisions)));
  const y = Math.min(divisions - 1, Math.max(0, Math.floor((1 - THREE.MathUtils.clamp(v, -1, 1)) * .5 * divisions)));
  return createEarthQuadtreeNode(face, level, x, y);
}

export function createEarthQuadtreeNode(face, level = 0, x = 0, y = 0) {
  if (!Number.isInteger(face) || face < 0 || face > 5 ||
      !Number.isInteger(level) || level < 0 ||
      !Number.isInteger(x) || !Number.isInteger(y) ||
      x < 0 || y < 0 || x >= 2 ** level || y >= 2 ** level) return null;
  return Object.freeze({ face, level, x, y, key: `${face}/${level}/${x}/${y}` });
}

export function getEarthQuadtreeChildren(node) {
  if (!node) return [];
  const level = node.level + 1;
  const x = node.x * 2, y = node.y * 2;
  return [
    createEarthQuadtreeNode(node.face, level, x, y),
    createEarthQuadtreeNode(node.face, level, x + 1, y),
    createEarthQuadtreeNode(node.face, level, x, y + 1),
    createEarthQuadtreeNode(node.face, level, x + 1, y + 1)
  ];
}

export function earthQuadtreeNodeCenter(node, target = new THREE.Vector3()) {
  const divisions = 2 ** node.level;
  const u = ((node.x + .5) / divisions) * 2 - 1;
  const v = 1 - ((node.y + .5) / divisions) * 2;
  return earthCubeFaceDirection(node.face, u, v, target);
}

function earthQuadtreeNodeAngularRadius(node) {
  return Math.min(Math.PI * .75, Math.SQRT2 / (2 ** node.level));
}

function targetEarthQuadtreeLevel(altitude, radius, maxLevel) {
  const ratio = Math.max(0, altitude) / radius;
  if (ratio > 4) return 0;
  if (ratio > 2) return Math.min(1, maxLevel);
  if (ratio > 1) return Math.min(2, maxLevel);
  if (ratio > .5) return Math.min(3, maxLevel);
  if (ratio > .2) return Math.min(4, maxLevel);
  if (ratio > .08) return Math.min(6, maxLevel);
  if (ratio > .025) return Math.min(8, maxLevel);
  if (ratio > .008) return Math.min(10, maxLevel);
  return maxLevel;
}

export function selectEarthQuadtreeTiles(cameraLocalPosition, radius, {
  maxLevel = 12,
  maxTiles = 48,
  cameraForwardLocal = null,
  cameraFovDeg = 75,
  cameraAspect = 1
} = {}) {
  if (!cameraLocalPosition?.isVector3 || !Number.isFinite(radius) || radius <= 0) return [];
  const distance = cameraLocalPosition.length();
  if (!(distance > 0)) return [];
  const direction = cameraLocalPosition.clone().normalize();
  const altitude = Math.max(0, distance - radius);
  // The player/camera may sit a few centimetres below the DEM surface because
  // of collision tolerances. Keep a one-metre geometric horizon instead of
  // collapsing regional visibility to zero when distance <= radius.
  const horizonDistance = Math.max(distance, radius + Math.max(1, radius * 1e-7));
  const horizonAngle = Math.acos(THREE.MathUtils.clamp(radius / horizonDistance, -1, 1));
  const targetLevel = targetEarthQuadtreeLevel(altitude, radius, maxLevel);
  const forward = cameraForwardLocal?.isVector3
    ? cameraForwardLocal.clone().normalize()
    : null;
  const halfFov = THREE.MathUtils.degToRad(
    THREE.MathUtils.clamp(cameraFovDeg, 10, 150) * .5
  );
  const aspect = THREE.MathUtils.clamp(cameraAspect || 1, .5, 3);
  const diagonalHalfFov = Math.atan(Math.tan(halfFov) * Math.sqrt(1 + aspect * aspect));
  const visible = node => {
    const center = earthQuadtreeNodeCenter(node);
    const angularRadius = earthQuadtreeNodeAngularRadius(node);
    const horizonDistance = Math.acos(THREE.MathUtils.clamp(direction.dot(center), -1, 1));
    if (horizonDistance > horizonAngle + angularRadius) return false;
    if (!forward) return true;
    const tilePosition = center.multiplyScalar(radius);
    const toTile = tilePosition.sub(cameraLocalPosition);
    if (toTile.lengthSq() < 1e-8) return true;
    const viewAngle = Math.acos(THREE.MathUtils.clamp(forward.dot(toTile.normalize()), -1, 1));
    return viewAngle <= diagonalHalfFov + angularRadius;
  };

  let leaves = Array.from({ length: 6 }, (_, face) => createEarthQuadtreeNode(face))
    .filter(visible);
  while (leaves.length + 3 <= maxTiles) {
    let candidateIndex = -1;
    let candidateScore = -Infinity;
    for (let i = 0; i < leaves.length; i++) {
      const node = leaves[i];
      if (node.level >= targetLevel) continue;
      const score = (targetLevel - node.level) + earthQuadtreeNodeAngularRadius(node) * .01;
      if (score > candidateScore) {
        candidateScore = score;
        candidateIndex = i;
      }
    }
    if (candidateIndex < 0) break;
    const parent = leaves[candidateIndex];
    const children = getEarthQuadtreeChildren(parent).filter(visible);
    if (!children.length) {
      leaves.splice(candidateIndex, 1);
      continue;
    }
    leaves.splice(candidateIndex, 1, ...children);
  }

  // Always render the tile directly beneath a near-surface observer. A third-
  // person camera looks toward the horizon, so a strict view-cone test can
  // otherwise discard the ground under the character and expose empty space.
  if (altitude <= radius * .01) {
    const groundAnchor = getEarthQuadtreeNodeForDirection(direction, targetLevel);
    // A coarse ancestor tile is not sufficient here: it can cover the anchor
    // geographically while still leaving the character without local detail.
    // Replace that ancestor with the high-resolution anchor tile so the ground
    // directly beneath the observer is always represented at targetLevel.
    const exactAnchorPresent = groundAnchor && leaves.some(node =>
      node.key === groundAnchor.key
    );
    if (groundAnchor && !exactAnchorPresent) {
      const ancestorIndex = leaves.findIndex(node => {
        if (node.face !== groundAnchor.face || node.level >= groundAnchor.level) return false;
        const shift = groundAnchor.level - node.level;
        return (groundAnchor.x >> shift) === node.x && (groundAnchor.y >> shift) === node.y;
      });
      if (ancestorIndex >= 0) leaves.splice(ancestorIndex, 1);
      if (leaves.length >= maxTiles) leaves.pop();
      leaves.push(groundAnchor);
    }
  }
  return leaves;
}

export function createEarthQuadtreeTileGeometry(node, radius, {
  segments = 32,
  elevationSampler = null,
  elevationMeters = null,
  elevationMetersToUnits = null,
  skirtUnits = 0.002,
  demEdgeBlend = 0.12
} = {}) {
  if (!node || !Number.isFinite(radius) || radius <= 0 ||
      !Number.isInteger(segments) || segments < 2) return null;
  const divisions = 2 ** node.level;
  const u0 = node.x / divisions * 2 - 1;
  const u1 = (node.x + 1) / divisions * 2 - 1;
  const v1 = 1 - node.y / divisions * 2;
  const v0 = 1 - (node.y + 1) / divisions * 2;
  const positions = new Float32Array((segments + 1) ** 2 * 3);
  const uvs = new Float32Array((segments + 1) ** 2 * 2);
  const indices = [];
  const direction = new THREE.Vector3();
  let vertex = 0;
  for (let row = 0; row <= segments; row++) {
    const v = THREE.MathUtils.lerp(v1, v0, row / segments);
    for (let column = 0; column <= segments; column++) {
      const u = THREE.MathUtils.lerp(u0, u1, column / segments);
      earthCubeFaceDirection(node.face, u, v, direction);
      const geographic = earthDirectionToLatLon(direction);
      const index = row * (segments + 1) + column;
      const meters = elevationMeters?.[index];
      const demUnits = Number.isFinite(meters) && elevationMetersToUnits
        ? elevationMetersToUnits(meters)
        : null;
      const fallbackUnits = typeof elevationSampler === 'function'
        ? elevationSampler(geographic.longitudeDeg, geographic.latitudeDeg)
        : 0;
      const safeFallback = Number.isFinite(fallbackUnits) ? fallbackUnits : 0;
      // DEM vertices are authoritative whenever data is available. Collision
      // samples the same cached Terrarium tile, so do not blend the visual mesh
      // back to ETOPO at tile edges and create a hidden physical step.
      const elevation = Number.isFinite(demUnits) ? demUnits : safeFallback;
      const finalRadius = radius + elevation + skirtUnits;
      positions[vertex++] = direction.x * finalRadius;
      positions[vertex++] = direction.y * finalRadius;
      positions[vertex++] = direction.z * finalRadius;
      uvs[index * 2] = earthLongitudeToSphereUv(geographic.longitudeDeg);
      // Match SphereGeometry's north-at-v=1 convention and TextureLoader flipY.
      uvs[index * 2 + 1] = (geographic.latitudeDeg + 90) / 180;
    }
  }
  for (let row = 0; row < segments; row++) {
    for (let column = 0; column < segments; column++) {
      const a = row * (segments + 1) + column;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.earthQuadtree = { ...node, segments };
  return geometry;
}

/**
 * Regional surface overlay. The global sphere remains the distant fallback;
 * this manager owns only camera-relevant cube-sphere tiles and builds at most
 * one tile per frame to keep mobile frame time bounded.
 */
export function createEarthRegionalSurfaceRuntime({
  surface,
  radius,
  elevationSampler,
  sampleElevationMetersBatch = null,
  elevationMetersToUnits = null,
  maxLevel = 12,
  maxTiles = 48,
  segments = 32,
  buildPerUpdate = 1
} = {}) {
  const active = new Map();
  const tileBuilds = new Map();
  const preparedTiles = new Set();
  const tileRoot = surface?.parent ?? surface;
  let pending = [];
  let buildToken = 0;
  let building = false;
  let lastCameraLocalPosition = null;
  let lastCameraForwardLocal = null;
  let lastCameraFov = null;
  let lastCameraAspect = null;
  let disposed = false;
  let lastSelection = [];
  let demActive = false;
  let lastDemActive = null;
  let lastError = null;
  let completedTiles = 0;
  let failedTiles = 0;
  let demTiles = 0;
  let fallbackTiles = 0;
  let lastCameraAltitude = null;
  let cameraInsideSurface = false;
  let firstRegionalTextureMs = null;
  let regionalTextureAfterLoadMs = null;
  let lastSyncedMap = surface?.material?.map ?? null;
  let lastSyncedEmissiveMap = surface?.material?.emissiveMap ?? null;
  let lastSyncedMaterialVersion = surface?.material?.version ?? 0;
  let generationStartedAt = null;
  let lastGenerationMs = null;
  let completedGenerations = 0;
  const nowMs = () => globalThis.performance?.now?.() ?? Date.now();

  const tileId = (node, useDem) => `${node.key}@${useDem ? 'dem' : 'base'}`;

  // Tiles may be created before the asynchronous NASA texture finishes loading.
  // Keep their cloned materials synchronized with the authoritative globe material.
  const syncMaterial = (target, source) => {
    if (!target || !source) return;
    let changed = false;
    for (const key of [
      'map', 'aoMap', 'lightMap', 'bumpMap', 'normalMap', 'displacementMap',
      'roughnessMap', 'metalnessMap', 'alphaMap', 'emissiveMap'
    ]) {
      if (target[key] !== source[key]) {
        target[key] = source[key];
        changed = true;
      }
    }
    if (target.color && source.color) target.color.copy(source.color);
    if (target.emissive && source.emissive) target.emissive.copy(source.emissive);
    target.roughness = source.roughness;
    target.metalness = source.metalness;
    target.emissiveIntensity = source.emissiveIntensity;
    if (changed) target.needsUpdate = true;
  };

  const syncActiveTileMaterials = (force = false) => {
    if (!surface?.material) return;
    const sourceMap = surface.material.map ?? null;
    const sourceEmissiveMap = surface.material.emissiveMap ?? null;
    const sourceVersion = surface.material.version ?? 0;
    if (!force && sourceMap === lastSyncedMap && sourceEmissiveMap === lastSyncedEmissiveMap &&
        sourceVersion === lastSyncedMaterialVersion) return;
    lastSyncedMap = sourceMap;
    lastSyncedEmissiveMap = sourceEmissiveMap;
    lastSyncedMaterialVersion = sourceVersion;
    for (const mesh of active.values()) {
      syncMaterial(mesh.material, surface.material);
      const timing = surface.userData?.earthBlueMarbleTiming;
      if (mesh.material?.map?.image && timing?.loadedAtMs != null && firstRegionalTextureMs === null) {
        const syncedAt = nowMs();
        firstRegionalTextureMs = syncedAt - timing.requestedAtMs;
        regionalTextureAfterLoadMs = syncedAt - timing.loadedAtMs;
      }
    }
  };

  const removeTile = key => {
    const mesh = active.get(key);
    if (!mesh) return;
    tileRoot?.remove(mesh);
    mesh.geometry?.dispose();
    mesh.material?.dispose();
    active.delete(key);
  };

  async function buildTileInternal(node, token, useDem) {
    const id = tileId(node, useDem);
    if (active.has(id)) return active.get(id);
    const points = [];
    const divisions = 2 ** node.level;
    const u0 = node.x / divisions * 2 - 1;
    const u1 = (node.x + 1) / divisions * 2 - 1;
    const v1 = 1 - node.y / divisions * 2;
    const v0 = 1 - (node.y + 1) / divisions * 2;
    const direction = new THREE.Vector3();
    for (let row = 0; row <= segments; row++) {
      const v = THREE.MathUtils.lerp(v1, v0, row / segments);
      for (let column = 0; column <= segments; column++) {
        const u = THREE.MathUtils.lerp(u0, u1, column / segments);
        earthCubeFaceDirection(node.face, u, v, direction);
        points.push(earthDirectionToLatLon(direction));
      }
    }

    let demValues = null;
    if (useDem && typeof sampleElevationMetersBatch === 'function') {
      try {
        demValues = await sampleElevationMetersBatch(points);
      } catch (error) {
        lastError = `DEM ${node.key}: ${error?.message ?? String(error)}`;
      }
    }
    if (disposed || token !== buildToken) return null;
    const hasDem = demValues && Array.from(demValues).some(Number.isFinite);
    const geometry = createEarthQuadtreeTileGeometry(node, radius, {
      segments,
      elevationSampler,
      elevationMeters: hasDem ? demValues : null,
      elevationMetersToUnits
    });
    if (!geometry) return null;
    const material = surface.material.clone();
    syncMaterial(material, surface.material);
    material.side = THREE.DoubleSide;
    material.depthTest = true;
    material.depthWrite = true;
    material.polygonOffset = true;
    material.polygonOffsetFactor = -2;
    material.polygonOffsetUnits = -2;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `Earth-Regional-Tile-${node.key.replaceAll('/', '-')}`;
    mesh.position.copy(surface.position);
    mesh.quaternion.copy(surface.quaternion);
    mesh.scale.copy(surface.scale);
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    mesh.userData.earthQuadtree = { ...node, elevationSource: hasDem ? 'regional-dem' : 'global-fallback' };
    tileRoot.add(mesh);
    active.set(id, mesh);
    completedTiles++;
    if (hasDem) demTiles++;
    else fallbackTiles++;
    return mesh;
  }


  async function buildTile(node, token, useDem) {
    const id = tileId(node, useDem);
    if (active.has(id)) return active.get(id);
    if (tileBuilds.has(id)) return tileBuilds.get(id);
    const task = buildTileInternal(node, token, useDem);
    tileBuilds.set(id, task);
    try {
      return await task;
    } finally {
      if (tileBuilds.get(id) === task) tileBuilds.delete(id);
    }
  }

  async function prepareRegion({ latitudeDeg, longitudeDeg, altitudeUnits = 0 } = {}) {
    if (disposed || !surface || !Number.isFinite(latitudeDeg) ||
        latitudeDeg < -90 || latitudeDeg > 90 || !Number.isFinite(longitudeDeg) ||
        longitudeDeg < -180 || longitudeDeg > 180 || !Number.isFinite(altitudeUnits) || altitudeUnits < 0) {
      return { ok: false, reason: 'invalid-region' };
    }
    const latitude = THREE.MathUtils.degToRad(latitudeDeg);
    const longitude = THREE.MathUtils.degToRad(longitudeDeg);
    const direction = new THREE.Vector3(
      Math.cos(latitude) * Math.cos(longitude),
      Math.sin(latitude),
      Math.cos(latitude) * Math.sin(longitude)
    );
    const level = targetEarthQuadtreeLevel(altitudeUnits, radius, maxLevel);
    const node = getEarthQuadtreeNodeForDirection(direction, level);
    if (!node) return { ok: false, reason: 'region-unresolved' };
    const useDem = typeof sampleElevationMetersBatch === 'function';
    const id = tileId(node, useDem);
    let mesh = active.get(id);
    if (!mesh) mesh = await buildTile(node, buildToken, useDem);
    if (!mesh || disposed) return { ok: false, reason: 'tile-not-ready', key: node.key };
    syncMaterial(mesh.material, surface.material);
    if (mesh.material?.map !== lastSyncedMap || mesh.material?.emissiveMap !== lastSyncedEmissiveMap) {
      mesh.material.needsUpdate = true;
    }
    preparedTiles.delete(id);
    preparedTiles.add(id);
    while (preparedTiles.size > 3) {
      const oldest = preparedTiles.values().next().value;
      preparedTiles.delete(oldest);
      if (!lastSelection.includes(oldest)) removeTile(oldest);
    }
    return { ok: true, key: node.key, textured: Boolean(mesh.material?.map?.image), elevationSource: mesh.userData?.earthQuadtree?.elevationSource };
  }

  return {
    prepareRegion,
    syncSurfaceMaterials() {
      syncActiveTileMaterials(true);
      return active.size;
    },
    update(delta, context) {
      if (disposed || !surface || !context?.camera) return;
      syncActiveTileMaterials();
      surface.updateWorldMatrix(true, false);
      context.camera.updateMatrixWorld?.();
      const cameraWorld = context.camera.getWorldPosition(new THREE.Vector3());
      const cameraLocal = surface.worldToLocal(cameraWorld);
      const signedAltitude = cameraLocal.length() - radius;
      const altitude = Math.max(0, signedAltitude);
      lastCameraAltitude = signedAltitude;
      cameraInsideSurface = signedAltitude < -0.5;
      // Start loading regional elevation well before the final descent. The
      // global ETOPO sampler remains the immediate fallback while DEM tiles load.
      demActive = signedAltitude <= radius * .5;
      const cameraForwardWorld = context.camera.getWorldDirection(new THREE.Vector3());
      const forwardLocal = surface.worldToLocal(cameraWorld.clone().add(cameraForwardWorld))
        .sub(cameraLocal).normalize();
      const cameraFov = context.camera.fov ?? 75;
      const cameraAspect = context.camera.aspect ?? 1;
      const positionThreshold = Math.max(0.5, radius * 1e-6);
      const directionThreshold = Math.cos(THREE.MathUtils.degToRad(2));
      const positionChanged = !lastCameraLocalPosition ||
        lastCameraLocalPosition.distanceTo(cameraLocal) >= positionThreshold;
      const directionChanged = !lastCameraForwardLocal ||
        lastCameraForwardLocal.dot(forwardLocal) <= directionThreshold;
      const projectionChanged = lastCameraFov === null ||
        Math.abs(lastCameraFov - cameraFov) > 0.01 ||
        Math.abs(lastCameraAspect - cameraAspect) > 0.01;
      const demModeChanged = demActive !== lastDemActive;
      if (!positionChanged && !directionChanged && !projectionChanged && !demModeChanged) return;
      lastCameraLocalPosition = cameraLocal.clone();
      lastCameraForwardLocal = forwardLocal.clone();
      lastCameraFov = cameraFov;
      lastCameraAspect = cameraAspect;
      let selected = altitude <= radius * 1.5
        ? selectEarthQuadtreeTiles(cameraLocal, radius, {
          maxLevel,
          maxTiles,
          cameraForwardLocal: forwardLocal,
          cameraFovDeg: Math.min(150, cameraFov + 10),
          cameraAspect
        })
        : [];
      // If the camera basis and Earth-local frame temporarily disagree, keep
      // horizon-visible terrain selected rather than showing no regional mesh.
      if (altitude <= radius * 1.5 && selected.length === 0) {
        selected = selectEarthQuadtreeTiles(cameraLocal, radius, {
          maxLevel: Math.min(maxLevel, 8),
          maxTiles
        });
      }
      const keys = selected.map(node => tileId(node, demActive));
      const changed = keys.length !== lastSelection.length ||
        keys.some((key, index) => key !== lastSelection[index]) || demModeChanged;
      for (const key of keys) preparedTiles.delete(key);
      if (changed) {
        // Keep the previous complete surface visible while its replacement is
        // built. A mode change creates a second tile generation instead of
        // deleting the ETOPO-backed generation before DEM data is ready.
        lastSelection = keys;
        lastDemActive = demActive;
        generationStartedAt = nowMs();
        pending = selected.filter(node => !active.has(tileId(node, demActive)));
        if (!keys.length) {
          for (const key of [...active.keys()]) {
            if (!preparedTiles.has(key)) removeTile(key);
          }
        }
      }
      if (!building && pending.length) {
        const token = buildToken;
        const useDem = demActive;
        const batch = pending.splice(0, Math.max(1, buildPerUpdate));
        building = true;
        Promise.all(batch.map(node => buildTile(node, token, useDem).catch(error => {
          failedTiles++;
          lastError = `Tile build: ${error?.message ?? String(error)}`;
          return null;
        }))).finally(() => {
          building = false;
          // Atomic handoff: retire old tiles only after every selected tile
          // in the new generation has been installed.
          if (lastSelection.every(key => active.has(key))) {
            if (generationStartedAt !== null) {
              lastGenerationMs = nowMs() - generationStartedAt;
              completedGenerations++;
              generationStartedAt = null;
            }
            for (const key of [...active.keys()]) {
              if (!lastSelection.includes(key) && !preparedTiles.has(key)) removeTile(key);
            }
          }
        });
      } else if (lastSelection.every(key => active.has(key))) {
        if (generationStartedAt !== null) {
          lastGenerationMs = nowMs() - generationStartedAt;
          completedGenerations++;
          generationStartedAt = null;
        }
        for (const key of [...active.keys()]) {
          if (!lastSelection.includes(key) && !preparedTiles.has(key)) removeTile(key);
        }
      }
    },
    getStatus() {
      const texturedTiles = [...active.values()].filter(mesh =>
        Boolean(mesh.material?.map?.image)
      ).length;
      return {
        mode: 'cube-sphere-quadtree',
        activeTiles: active.size,
        texturedTiles,
        untexturedTiles: active.size - texturedTiles,
        textureCoverage: active.size ? texturedTiles / active.size : 0,
        queuedTiles: pending.length,
        building,
        selectedTiles: lastSelection.length,
        completedTiles,
        failedTiles,
        demTiles,
        fallbackTiles,
        cameraAltitudeUnits: lastCameraAltitude,
        cameraInsideSurface,
        retiringTiles: [...active.keys()].filter(key => !lastSelection.includes(key) && !preparedTiles.has(key)).length,
        maxLevel,
        maxTiles,
        tileSegments: segments,
        demEnabled: typeof sampleElevationMetersBatch === 'function',
        demActive,
        lastError,
        firstRegionalTextureMs,
        regionalTextureAfterLoadMs,
        lastGenerationMs,
        completedGenerations,
        selectedKeys: [...lastSelection],
        preparedTiles: preparedTiles.size
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      buildToken++;
      pending = [];
      preparedTiles.clear();
      for (const key of [...active.keys()]) removeTile(key);
    }
  };
}
