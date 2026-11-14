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
import { EARTH_UE5_INTEROP, getEarthEngineInteropStatus } from './interop/ue5Contract.js';

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
    radius: options.radius ?? 300,
    position: options.position ?? [0, 0, -240],
    ...options
  };
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
    version: '1.5.0',
    referencePolicy: EARTH_REFERENCE_POLICY,
    references: EARTH_REFERENCE_SOURCES,
    engineInterop: EARTH_UE5_INTEROP,
    updateModules: EARTH_UPDATE_MODULES,
    attachUpdateModule(id, runtime) {
      if (disposed) return false;
      return updatePipeline.attach(id, runtime);
    },
    update(delta) {
      if (disposed) return;
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
        version: '1.5.0',
        renderer: 'modular-earth-runtime',
        referencesAreAdvisory: true,
        engineInterop: getEarthEngineInteropStatus(),
        updateModules: updatePipeline.getStatus(),
        disposed
      };
    }
  };
}
