import * as THREE from 'three';
import { EARTH_AXIAL_TILT_DEGREES } from '../../physics/planetaryGravitySystem.js';
import { EARTH_REFERENCE_POLICY, EARTH_REFERENCE_SOURCES } from './references/index.js';
import { EARTH_UPDATE_MODULES } from './modules/index.js';
import { createEarthUpdatePipeline } from './earthUpdatePipeline.js';
import { createInteriorRuntime } from './modules/runtime/interior.js';
import { createBlueMarbleSurfaceRuntime } from './modules/runtime/blueMarbleSurface.js';
import { createTerrainRuntime } from './modules/runtime/terrain.js';
import { createOceansRuntime } from './modules/runtime/oceans.js';
import { createBlueMarbleAtmosphereRuntime } from './modules/runtime/blueMarbleAtmosphere.js';
import { createCloudsRuntime } from './modules/runtime/clouds.js';
import { createBlueMarbleLightingRuntime } from './modules/runtime/blueMarbleLighting.js';
import { createEarthInfrastructureRuntime } from './modules/runtime/infrastructure.js';
import { createEarthPlanetaryProfile } from './planetaryProfile.js';

const RUNTIME_FACTORIES = Object.freeze({
  interior: createInteriorRuntime,
  surface: createBlueMarbleSurfaceRuntime,
  terrain: createTerrainRuntime,
  oceans: createOceansRuntime,
  atmosphere: createBlueMarbleAtmosphereRuntime,
  clouds: createCloudsRuntime,
  lighting: createBlueMarbleLightingRuntime,
  infrastructure: createEarthInfrastructureRuntime
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
  settings.physicalScale = planetaryProfile.physicalScale;

  const group = new THREE.Group();
  group.name = 'StarFrontier-Earth-Core';
  group.position.set(...settings.position);

  // Frame terrestre compartilhado pela superfície, pelo relevo e pelos atores no solo.
  const surfaceFrame = new THREE.Group();
  surfaceFrame.name = 'StarFrontier-Earth-Terrestrial-Frame';
  surfaceFrame.rotation.z = THREE.MathUtils.degToRad(EARTH_AXIAL_TILT_DEGREES);
  group.add(surfaceFrame);

  const layers = {};
  const context = { group, surfaceFrame, options: settings, layers };
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
    version: '1.7.0',
    referencePolicy: EARTH_REFERENCE_POLICY,
    references: EARTH_REFERENCE_SOURCES,
    getPlanetaryProfile() {
      return planetaryProfile;
    },
    getPhysicalScale() {
      return planetaryProfile.physicalScale;
    },
    getSurfaceFrame() {
      return surfaceFrame;
    },
    // Shared physical query surface: the collision system consumes the same
    // elevation sampler that displaces the rendered Earth mesh.
    getCollisionSurface() {
      return layers.terrain?.collisionSurface ?? null;
    },
    // Exposes the rendered axial spin so grounded world objects can share
    // the same angular transform without becoming children of the Earth mesh.
    getSurfaceRotationState() {
      if (!layers.surface) return null;
      return {
        rotationY: surfaceFrame.rotation.y,
        localAxis: new THREE.Vector3(0, 1, 0).applyQuaternion(surfaceFrame.quaternion)
      };
    },
    getLandingBase() {
      return layers.infrastructure?.getBase?.() ?? null;
    },
    getLandingSiteMarker() {
      return layers.infrastructure?.getMarker?.() ?? null;
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
        version: '1.7.0',
        renderer: 'nasa-blue-marble-visual-runtime',
        surfaceVisual: layers.surfaceVisual ?? null,
        atmosphereVisual: layers.atmosphereVisual ?? null,
        referencesAreAdvisory: true,
        planetaryProfile: {
          id: planetaryProfile.id,
          physicalMeanRadiusKm: planetaryProfile.physical.meanRadiusKm,
          visualRadiusUnits: planetaryProfile.render.visualRadiusUnits,
          visualUnitsPerKm: planetaryProfile.render.visualUnitsPerKm,
          metersPerVisualUnit: planetaryProfile.render.metersPerVisualUnit,
          renderUnitsPerMeter: planetaryProfile.physicalScale.renderUnitsPerMeter
        },
        terrain: layers.terrain ? {
          elevationSource: layers.terrain.elevationSource,
          sourceGridReady: layers.terrain.sourceGridReady,
          etopoStatus: layers.terrain.etopoStatus,
          verticalDatum: layers.terrain.verticalDatum ?? null,
          gridResolutionArcSeconds: layers.terrain.gridResolutionArcSeconds ?? null,
          verticalExaggeration: layers.terrain.verticalExaggeration,
          visualVerticalExaggeration: layers.terrain.visualVerticalExaggeration,
          regionalSurface: layers.terrain.regionalSurface ?? null,
          regionalDem: layers.terrain.regionalDem ?? null
        } : null,
        updateModules: updatePipeline.getStatus(),
        disposed
      };
    }
  };
}
