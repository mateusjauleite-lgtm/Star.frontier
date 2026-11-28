import * as THREE from 'three';
import { EARTH_LOD_SEGMENTS, selectEarthLodLevel } from './surface.js';

export const EARTH_BLUE_MARBLE_TEXTURE_PATH =
  'earth/blue-marble-topography-bathymetry.jpg';

export function resolveEarthTextureUrl(baseUrl = './') {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${EARTH_BLUE_MARBLE_TEXTURE_PATH}`;
}

/**
 * Visual Earth surface based on NASA Blue Marble Next Generation with topography
 * and bathymetry. Terrain displacement and collision remain owned by terrain.js.
 */
export function createBlueMarbleSurfaceRuntime({
  surfaceFrame,
  options,
  layers
}) {
  let mesh = null;
  let geometry = null;
  let material = null;
  let texture = null;
  let disposed = false;
  let currentLevel = 0;
  let lodCheckElapsed = 0;
  let textureState = 'loading';
  let textureError = null;
  let textureRequestedAt = null;
  let textureLoadedAt = null;
  const nowMs = () => globalThis.performance?.now?.() ?? Date.now();

  return {
    initialize() {
      const initial = EARTH_LOD_SEGMENTS[0];
      geometry = new THREE.SphereGeometry(
        options.radius,
        initial.width,
        initial.height
      );
      material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.94,
        metalness: 0,
        emissive: 0xffffff,
        emissiveIntensity: 0.16,
        dithering: true
      });
      mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'Earth-Blue-Marble-Surface';
      mesh.userData.earthLodGeometries = [geometry];
      mesh.userData.earthLodLevel = currentLevel;
      mesh.userData.visualSource = 'NASA Blue Marble Next Generation — Topography and Bathymetry';
      surfaceFrame.add(mesh);
      layers.surface = mesh;
      layers.surfaceVisual = {
        source: 'NASA Blue Marble Next Generation — Topography and Bathymetry',
        texture: EARTH_BLUE_MARBLE_TEXTURE_PATH,
        state: textureState,
        resolution: '4096x2048 (optimized from NASA 5400x2700)',
        attribution: 'NASA Earth Observatory'
      };

      textureRequestedAt = nowMs();
      mesh.userData.earthBlueMarbleTiming = { textureLoadMs: null, textureState: 'loading', requestedAtMs: textureRequestedAt, loadedAtMs: null };
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin?.('anonymous');
      texture = loader.load(
        resolveEarthTextureUrl(import.meta.env.BASE_URL),
        loadedTexture => {
          if (disposed) {
            loadedTexture.dispose();
            return;
          }
          loadedTexture.colorSpace = THREE.SRGBColorSpace;
          material.color.set(0xffffff);
          loadedTexture.wrapS = THREE.RepeatWrapping;
          loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
          loadedTexture.generateMipmaps = true;
          loadedTexture.minFilter = THREE.LinearMipmapLinearFilter;
          loadedTexture.magFilter = THREE.LinearFilter;
          loadedTexture.anisotropy = Math.max(
            1,
            Math.min(4, options.textureAnisotropy ?? 4)
          );
          material.map = loadedTexture;
          // Low-level self-illumination keeps the Blue Marble geography readable
          // on the night side and during close surface approach without replacing
          // the single scene-level directional sunlight.
          material.emissiveMap = loadedTexture;
          material.needsUpdate = true;
          // Regional tiles share this authoritative texture immediately; do not
          // wait for the next camera/LOD selection cycle to update their maps.
          layers.terrain?.syncSurfaceMaterials?.();
          textureState = 'ready';
          textureLoadedAt = nowMs();
          mesh.userData.earthBlueMarbleTiming.textureLoadMs = textureLoadedAt - textureRequestedAt;
          mesh.userData.earthBlueMarbleTiming.loadedAtMs = textureLoadedAt;
          mesh.userData.earthBlueMarbleTiming.textureState = textureState;
          layers.surfaceVisual.textureLoadMs = textureLoadedAt - textureRequestedAt;
          layers.surfaceVisual.state = textureState;
          console.info('[Earth] Blue Marble texture loaded:', {
            width: loadedTexture.image?.width ?? null,
            height: loadedTexture.image?.height ?? null
          });
        },
        undefined,
        error => {
          textureState = 'fallback';
          if (mesh?.userData?.earthBlueMarbleTiming) mesh.userData.earthBlueMarbleTiming.textureState = textureState;
          textureError = error?.message ?? 'NASA Blue Marble texture could not be loaded';
          layers.surfaceVisual.textureLoadMs = nowMs() - textureRequestedAt;
          console.warn('[Earth] Blue Marble texture failed to load:', textureError);
          if (layers.surfaceVisual) {
            layers.surfaceVisual.state = textureState;
            layers.surfaceVisual.error = textureError;
          }
        }
      );
    },

    update(delta, context) {
      if (!mesh || disposed) return;
      // A orientação angular é definida pelo relógio astronômico em EarthCore.
      // Não integre a rotação aqui: isso criaria um segundo relógio independente.
      const step = Math.min(Math.max(delta || 0, 0), 0.1);
      lodCheckElapsed += step;
      if (lodCheckElapsed < 0.35) return;
      lodCheckElapsed = 0;

      const camera = context?.camera;
      if (!camera) return;
      camera.updateMatrixWorld?.();
      surfaceFrame.updateWorldMatrix(true, false);
      const cameraPosition = camera.getWorldPosition(new THREE.Vector3());
      const earthPosition = surfaceFrame.getWorldPosition(new THREE.Vector3());
      const distance = cameraPosition.distanceTo(earthPosition);
      const nextLevel = selectEarthLodLevel(
        distance,
        options.radius,
        currentLevel
      );
      if (nextLevel === currentLevel) return;

      const segments = EARTH_LOD_SEGMENTS[nextLevel];
      const nextGeometry = new THREE.SphereGeometry(
        options.radius,
        segments.width,
        segments.height
      );
      const previousGeometry = geometry;
      geometry = nextGeometry;
      currentLevel = nextLevel;
      mesh.geometry = nextGeometry;
      mesh.userData.earthLodGeometries = [nextGeometry];
      mesh.userData.earthLodLevel = nextLevel;
      previousGeometry?.dispose();
      layers.terrain?.refreshGeometry?.();
    },

    getStatus() {
      return {
        source: 'NASA Blue Marble Next Generation — Topography and Bathymetry',
        texture: EARTH_BLUE_MARBLE_TEXTURE_PATH,
        textureState,
        textureError,
        textureLoadMs: mesh?.userData?.earthBlueMarbleTiming?.textureLoadMs ?? null,
        lodLevel: currentLevel,
        disposed
      };
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      if (mesh) surfaceFrame.remove(mesh);
      geometry?.dispose();
      material?.dispose();
      texture?.dispose();
      if (layers.surface === mesh) layers.surface = null;
    }
  };
}
