import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;

function hash(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function craterField(longitude, latitude) {
  let elevation = 0;
  for (let level = 0; level < 4; level += 1) {
    const step = [7, 15, 31, 63][level];
    const x = Math.floor((longitude + 180) / 360 * step);
    const y = Math.floor((latitude + 90) / 180 * step);
    const radius = 0.22 + hash(x + level * 97, y - level * 53) * 0.52;
    const cx = (x + hash(x + 19, y + 7)) / step * 360 - 180;
    const cy = (y + hash(x - 11, y + 31)) / step * 180 - 90;
    const dx = THREE.MathUtils.euclideanModulo(longitude - cx + 180, 360) - 180;
    const dy = latitude - cy;
    const angularDistance = Math.hypot(dx * Math.cos(THREE.MathUtils.degToRad(latitude)), dy);
    const r = angularDistance / (radius * (level === 0 ? 1.8 : 0.9));
    const basin = -Math.exp(-((r / 0.72) ** 2)) * (level === 0 ? 260 : 90);
    const rim = Math.exp(-(((r - 1) / 0.13) ** 2)) * (level === 0 ? 105 : 32);
    const ejecta = Math.exp(-(((r - 1.28) / 0.22) ** 2)) * (level === 0 ? 22 : 8);
    elevation += basin + rim + ejecta;
  }
  const roughness = Math.sin(longitude * 0.41) * Math.cos(latitude * 0.73) * 16
    + Math.sin(longitude * 1.7 + latitude * 2.1) * 5;
  return clamp(elevation + roughness, -1800, 1100);
}

export function sampleMoonElevationMeters(longitudeDeg, latitudeDeg) {
  if (![longitudeDeg, latitudeDeg].every(Number.isFinite) ||
      latitudeDeg < -90 || latitudeDeg > 90) return null;
  const longitude = THREE.MathUtils.euclideanModulo(longitudeDeg + 180, 360) - 180;
  return craterField(longitude, latitudeDeg);
}

export function createMoonSurfaceRuntime({ surfaceFrame, radiusMeters, physicalScale }) {
  if (!surfaceFrame?.isObject3D || !Number.isFinite(radiusMeters) ||
      !physicalScale?.metersToRenderUnits) {
    throw new TypeError('Moon surface requires its own frame and authoritative SI scale.');
  }

  const geometry = new THREE.SphereGeometry(radiusMeters, 256, 128);
  const positions = geometry.attributes.position;
  const direction = new THREE.Vector3();
  const color = new THREE.Color();
  const colors = new Float32Array(positions.count * 3);
  const elevations = new Float32Array(positions.count);

  for (let i = 0; i < positions.count; i += 1) {
    direction.fromBufferAttribute(positions, i).normalize();
    const latitude = THREE.MathUtils.radToDeg(Math.asin(clamp(direction.y, -1, 1)));
    const longitude = THREE.MathUtils.radToDeg(Math.atan2(direction.z, direction.x));
    const elevation = sampleMoonElevationMeters(longitude, latitude);
    elevations[i] = elevation;
    const finalRadius = radiusMeters + physicalScale.metersToRenderUnits(elevation);
    positions.setXYZ(i, direction.x * finalRadius, direction.y * finalRadius, direction.z * finalRadius);
    const shade = clamp(0.47 + elevation / 7000 + (hash(i, 23) - 0.5) * 0.08, 0.24, 0.78);
    color.setRGB(shade, shade * 0.985, shade * 0.95);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.98,
    metalness: 0,
    flatShading: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'StarFrontier-Moon-Cratered-Terrain';
  mesh.userData.surfaceBodyId = 'moon';
  mesh.userData.elevationSource = 'deterministic-procedural-lunar-relief';
  surfaceFrame.add(mesh);

  function sampleLocalSurface(longitudeDeg, latitudeDeg) {
    const elevationMeters = sampleMoonElevationMeters(longitudeDeg, latitudeDeg);
    if (!Number.isFinite(elevationMeters)) return null;
    const lon = THREE.MathUtils.degToRad(longitudeDeg);
    const lat = THREE.MathUtils.degToRad(latitudeDeg);
    const direction = new THREE.Vector3(
      Math.cos(lat) * Math.cos(lon),
      Math.sin(lat),
      Math.cos(lat) * Math.sin(lon)
    );
    const radius = radiusMeters + physicalScale.metersToRenderUnits(elevationMeters);
    return {
      elevationMeters,
      localPosition: direction.multiplyScalar(radius),
      localNormal: direction.clone()
    };
  }

  function sampleWorldPosition(worldPosition) {
    if (!worldPosition?.isVector3) return null;
    surfaceFrame.updateWorldMatrix(true, true);
    const local = surfaceFrame.worldToLocal(worldPosition.clone());
    const radial = local.length();
    if (!(radial > 0)) return null;
    const direction = local.clone().normalize();
    const latitudeDeg = THREE.MathUtils.radToDeg(Math.asin(clamp(direction.y, -1, 1)));
    const longitudeDeg = THREE.MathUtils.radToDeg(Math.atan2(direction.z, direction.x));
    const sample = sampleLocalSurface(longitudeDeg, latitudeDeg);
    if (!sample) return null;
    const localNormal = sample.localNormal;
    const worldPositionOnSurface = surfaceFrame.localToWorld(sample.localPosition.clone());
    const worldNormal = localNormal.transformDirection(surfaceFrame.matrixWorld).normalize();
    return {
      bodyId: 'moon',
      longitudeDeg,
      latitudeDeg,
      elevationMeters: sample.elevationMeters,
      worldPosition: worldPositionOnSurface,
      worldNormal,
      clearanceMeters: (radial - radiusMeters) / physicalScale.renderUnitsPerMeter -
        sample.elevationMeters
    };
  }

  return {
    mesh,
    sampleLocalSurface,
    sampleWorldPosition,
    getStatus: () => ({
      bodyId: 'moon',
      state: 'ready',
      source: 'deterministic-procedural-lunar-relief',
      vertices: positions.count,
      verticalExaggeration: 1,
      collisionSharesRenderedElevation: true
    }),
    dispose() {
      surfaceFrame.remove(mesh);
      geometry.dispose();
      material.dispose();
    }
  };
}
