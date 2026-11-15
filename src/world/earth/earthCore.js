import * as THREE from 'three';
import { EARTH_REFERENCE_POLICY, EARTH_REFERENCE_SOURCES } from './references/index.js';
import { EARTH_UPDATE_MODULES } from './modules/index.js';
import { createEarthUpdatePipeline } from './earthUpdatePipeline.js';
import { createInteriorRuntime } from './modules/runtime/interior.js';
import { createSurfaceRuntime } from './modules/runtime/surface.js';
import { createTerrainRuntime } from './modules/runtime/terrain.js';
import { createOceansRuntime } from './modules/runtime/oceans.js';
import { createAtmosphereRuntime } from './modules/runtime/atmosphere.js';
import { createCloudsRuntime } from './modules/runtime/clouds.js';
import { createLightingRuntime } from './modules/runtime/lighting.js';
import { createEarthPlanetaryProfile } from './planetaryProfile.js';

const RUNTIME_FACTORIES = Object.freeze({
  interior: createInteriorRuntime,
  surface: createSurfaceRuntime,
  terrain: createTerrainRuntime,
  oceans: createOceansRuntime,
  atmosphere: createAtmosphereRuntime,
  clouds: createCloudsRuntime,
  lighting: createLightingRuntime
});

/**
 * New-generation Earth core. It owns a clean scene graph and attaches each
 * independently implemented visual layer through the module lifecycle pipeline.
 * The previous renderer remains in earth.js only as a comparison baseline.
 */
export function createEarthCore(options = {}) {
  const settings = {
    radius: options.radius ?? 600,
    position: options.position ?? [0, 0, -240],
    ...options
  };
  const planetaryProfile = createEarthPlanetaryProfile({
    visualRadiusUnits: settings.radius
  });
  const group = new THREE.Group();
  group.name = 'StarFrontier-Earth-Core';
  group.position.set(...settings.position);

  const layers = {};
  const context = { group, options: settings, layers };
  const updatePipeline = createEarthUpdatePipeline(EARTH_UPDATE_MODULES);
  let disposed = false;

  for (const definition of EARTH_UPDATE_MODULES) {
    const factory = RUNTIME_FACTORIES[definition.id];
    if (!factory) continue;
    const attached = updatePipeline.attach(definition.id, factory(context));
    if (!attached) throw new Error(`Unable to initialize Earth module: ${definition.id}`);
  }

  return {
    group,
    version: '1.6.0',
    referencePolicy: EARTH_REFERENCE_POLICY,
    references: EARTH_REFERENCE_SOURCES,
    getPlanetaryProfile() {
      return planetaryProfile;
    },
    // Shared physical query surface: collision reads the same ETOPO elevation
    // sampler that displaces the visible terrain mesh.
    getCollisionSurface() {
      return layers.terrain?.collisionSurface ?? null;
    },
    updateModules: EARTH_UPDATE_MODULES,
    attachUpdateModule(id, runtime) {
      if (disposed) return false;
      return updatePipeline.attach(id, runtime);
    },
    update(delta, camera = null) {
      if (disposed) return;
      context.camera = camera;
      updatePipeline.update(delta, context);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      updatePipeline.dispose();
    },
    getStatus() {
      return {
        core: 'ready',
        version: '1.6.0',
        renderer: 'modular-earth-runtime',
        referencesAreAdvisory: true,
        planetaryProfile: {
          id: planetaryProfile.id,
          physicalMeanRadiusKm: planetaryProfile.physical.meanRadiusKm,
          visualRadiusUnits: planetaryProfile.render.visualRadiusUnits,
          visualUnitsPerKm: planetaryProfile.render.visualUnitsPerKm
        },
        terrain: layers.terrain ? {
          elevationSource: layers.terrain.elevationSource,
          sourceGridReady: layers.terrain.sourceGridReady,
          etopoStatus: layers.terrain.etopoStatus,
          verticalDatum: layers.terrain.verticalDatum ?? null,
          gridResolutionArcSeconds: layers.terrain.gridResolutionArcSeconds ?? null,
          verticalExaggeration: layers.terrain.verticalExaggeration
        } : null,
        updateModules: updatePipeline.getStatus(),
        disposed
      };
    }
  };
}
