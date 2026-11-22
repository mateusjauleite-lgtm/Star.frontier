import * as THREE from 'three';

const FACE_MAP = Object.freeze([
  (u, v, out) => out.set(1, v, -u),
  (u, v, out) => out.set(-1, v, u),
  (u, v, out) => out.set(u, 1, -v),
  (u, v, out) => out.set(u, -1, v),
  (u, v, out) => out.set(u, v, 1),
  (u, v, out) => out.set(-u, v, -1)
]);

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
  maxTiles = 48
} = {}) {
  if (!cameraLocalPosition?.isVector3 || !Number.isFinite(radius) || radius <= 0) return [];
  const distance = cameraLocalPosition.length();
  if (!(distance > 0)) return [];
  const direction = cameraLocalPosition.clone().normalize();
  const altitude = Math.max(0, distance - radius);
  const horizonAngle = Math.acos(THREE.MathUtils.clamp(radius / distance, -1, 1));
  const targetLevel = targetEarthQuadtreeLevel(altitude, radius, maxLevel);
  const visible = node => {
    const center = earthQuadtreeNodeCenter(node);
    const angle = Math.acos(THREE.MathUtils.clamp(direction.dot(center), -1, 1));
    return angle <= horizonAngle + earthQuadtreeNodeAngularRadius(node);
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
      const edgeDistance = Math.min(
        column / segments, 1 - column / segments,
        row / segments, 1 - row / segments
      );
      const edgeBlend = THREE.MathUtils.smoothstep(
        edgeDistance, 0, Math.max(.001, demEdgeBlend)
      );
      const elevation = Number.isFinite(demUnits)
        ? THREE.MathUtils.lerp(safeFallback, demUnits, edgeBlend)
        : safeFallback;
      const finalRadius = radius + elevation + skirtUnits;
      positions[vertex++] = direction.x * finalRadius;
      positions[vertex++] = direction.y * finalRadius;
      positions[vertex++] = direction.z * finalRadius;
      uvs[index * 2] = (geographic.longitudeDeg + 180) / 360;
      uvs[index * 2 + 1] = (90 - geographic.latitudeDeg) / 180;
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
  let pending = [];
  let buildToken = 0;
  let building = false;
  let elapsed = 0;
  let disposed = false;
  let lastSelection = [];
  let demActive = false;
  let lastDemActive = null;

  const removeTile = key => {
    const mesh = active.get(key);
    if (!mesh) return;
    surface.remove(mesh);
    mesh.geometry?.dispose();
    mesh.material?.dispose();
    active.delete(key);
  };

  async function buildTile(node, token) {
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
    if (demActive && typeof sampleElevationMetersBatch === 'function') {
      try { demValues = await sampleElevationMetersBatch(points); } catch {}
    }
    if (disposed || token !== buildToken || !lastSelection.includes(node.key)) return;
    const hasDem = demValues && Array.from(demValues).some(Number.isFinite);
    const geometry = createEarthQuadtreeTileGeometry(node, radius, {
      segments,
      elevationSampler,
      elevationMeters: hasDem ? demValues : null,
      elevationMetersToUnits
    });
    if (!geometry) return;
    const material = surface.material.clone();
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1;
    material.polygonOffsetUnits = -1;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `Earth-Regional-Tile-${node.key.replaceAll('/', '-')}`;
    mesh.userData.earthQuadtree = { ...node, elevationSource: hasDem ? 'regional-dem' : 'global-fallback' };
    surface.add(mesh);
    active.set(node.key, mesh);
  }

  return {
    update(delta, context) {
      if (disposed || !surface || !context?.camera) return;
      elapsed += Math.min(Math.max(delta || 0, 0), .1);
      if (elapsed < .35) return;
      elapsed = 0;
      surface.updateWorldMatrix(true, false);
      context.camera.updateMatrixWorld?.();
      const cameraWorld = context.camera.getWorldPosition(new THREE.Vector3());
      const cameraLocal = surface.worldToLocal(cameraWorld);
      const altitude = Math.max(0, cameraLocal.length() - radius);
      demActive = altitude <= radius * .08;
      const selected = altitude <= radius * 1.5
        ? selectEarthQuadtreeTiles(cameraLocal, radius, { maxLevel, maxTiles })
        : [];
      const keys = selected.map(node => node.key);
      const demModeChanged = demActive !== lastDemActive;
      const changed = keys.length !== lastSelection.length ||
        keys.some((key, index) => key !== lastSelection[index]) || demModeChanged;
      if (changed) {
        buildToken++;
        lastSelection = keys;
        lastDemActive = demActive;
        if (demModeChanged) {
          for (const key of [...active.keys()]) removeTile(key);
        }
        pending = selected.filter(node => !active.has(node.key));
        for (const key of active.keys()) {
          if (!keys.includes(key)) removeTile(key);
        }
      }
      if (!building && pending.length) {
        const token = buildToken;
        const batch = pending.splice(0, Math.max(1, buildPerUpdate));
        building = true;
        Promise.all(batch.map(node => buildTile(node, token).catch(() => null)))
          .finally(() => { building = false; });
      }
    },
    getStatus() {
      return {
        mode: 'cube-sphere-quadtree',
        activeTiles: active.size,
        queuedTiles: pending.length,
        maxLevel,
        maxTiles,
        tileSegments: segments,
        demEnabled: typeof sampleElevationMetersBatch === 'function',
        demActive,
        selectedKeys: [...lastSelection]
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      buildToken++;
      pending = [];
      for (const key of [...active.keys()]) removeTile(key);
    }
  };
}
