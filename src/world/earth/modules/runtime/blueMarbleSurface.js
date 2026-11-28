import * as THREE from 'three';
import { EARTH_LOD_SEGMENTS, selectEarthLodLevel } from './surface.js';

export const EARTH_BLUE_MARBLE_TEXTURE_PATH =
  'earth/blue-marble-topography-bathymetry.jpg';
export const EARTH_REGIONAL_COLOR_TEXTURE_PATH = 'earth/jau-regional-500m.jpg';
export const EARTH_REGIONAL_COLOR_BOUNDS = Object.freeze({
  west: -52.557,
  east: -44.557,
  south: -26.2964,
  north: -18.2964
});

function resolveEarthAssetUrl(assetPath, baseUrl = './') {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${assetPath}`;
}

export function resolveEarthTextureUrl(baseUrl = './') {
  return resolveEarthAssetUrl(EARTH_BLUE_MARBLE_TEXTURE_PATH, baseUrl);
}

export function resolveEarthRegionalColorUrl(baseUrl = './') {
  return resolveEarthAssetUrl(EARTH_REGIONAL_COLOR_TEXTURE_PATH, baseUrl);
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
  let regionalColorTexture = null;
  let regionalColorState = 'loading';
  let regionalColorError = null;
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
        resolution: '6144x3072 (optimized from NASA 21600x10800, 2 km source)',
        regionalColorTexture: EARTH_REGIONAL_COLOR_TEXTURE_PATH,
        regionalColorBounds: EARTH_REGIONAL_COLOR_BOUNDS,
        regionalColorState,
        attribution: 'NASA Earth Observatory'
      };
      mesh.userData.earthRegionalColorBounds = EARTH_REGIONAL_COLOR_BOUNDS;
      mesh.userData.earthRegionalColorState = regionalColorState;

      textureRequestedAt = nowMs();
      mesh.userData.earthBlueMarbleTiming = { textureLoadMs: null, textureState: 'loading', requestedAtMs: textureRequestedAt, loadedAtMs: null };
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin?.('anonymous');
      regionalColorTexture = loader.load(
        resolveEarthRegionalColorUrl(import.meta.env.BASE_URL),
        loadedTexture => {
          if (disposed) {
            loadedTexture.dispose();
            return;
          }
          loadedTexture.colorSpace = THREE.SRGBColorSpace;
          loadedTexture.wrapS = THREE.ClampToEdgeWrapping;
          loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
          loadedTexture.generateMipmaps = true;
          loadedTexture.minFilter = THREE.LinearMipmapLinearFilter;
          loadedTexture.magFilter = THREE.LinearFilter;
          loadedTexture.anisotropy = Math.max(1, Math.min(4, options.textureAnisotropy ?? 4));
          mesh.userData.earthRegionalColorTexture = loadedTexture;
          regionalColorState = 'ready';
          mesh.userData.earthRegionalColorState = regionalColorState;
          layers.surfaceVisual.regionalColorState = regionalColorState;
          layers.surfaceVisual.regionalColorDimensions = {
            width: loadedTexture.image?.width ?? null,
            height: loadedTexture.image?.height ?? null
          };
          layers.terrain?.syncSurfaceMaterials?.();
          console.info('[Earth] Jaú regional 500 m color texture loaded:', {
            width: loadedTexture.image?.width ?? null,
            height: loadedTexture.image?.height ?? null,
            bounds: EARTH_REGIONAL_COLOR_BOUNDS
          });
        },
        undefined,
        error => {
          regionalColorState = 'fallback';
          regionalColorError = error?.message ?? 'Jaú regional color texture could not be loaded';
          if (mesh?.userData) mesh.userData.earthRegionalColorState = regionalColorState;
          if (layers.surfaceVisual) {
            layers.surfaceVisual.regionalColorState = regionalColorState;
            layers.surfaceVisual.regionalColorError = regionalColorError;
          }
          console.warn('[Earth] Jaú regional color texture failed to load:', regionalColorError);
        }
      );
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
          textureState = 'ready';
          textureLoadedAt = nowMs();
          mesh.userData.earthBlueMarbleTiming.textureLoadMs = textureLoadedAt - textureRequestedAt;
          mesh.userData.earthBlueMarbleTiming.loadedAtMs = textureLoadedAt;
          mesh.userData.earthBlueMarbleTiming.textureState = textureState;
          layers.surfaceVisual.textureLoadMs = textureLoadedAt - textureRequestedAt;
          layers.surfaceVisual.state = textureState;
          // Sync after load timing/state is committed so tile diagnostics measure
          // the actual asynchronous handoff, not only the map assignment.
          layers.terrain?.syncSurfaceMaterials?.();
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
        regionalColorTexture: EARTH_REGIONAL_COLOR_TEXTURE_PATH,
        regionalColorState,
        regionalColorError,
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
      regionalColorTexture?.dispose();
      if (layers.surface === mesh) layers.surface = null;
    }
  };
}
