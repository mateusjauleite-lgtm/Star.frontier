import { createEarth } from '../earth.js';
import { EARTH_REFERENCE_POLICY, EARTH_REFERENCE_SOURCES } from './references/index.js';
import { EARTH_UPDATE_MODULES } from './modules/index.js';
import { createEarthUpdatePipeline } from './earthUpdatePipeline.js';

/**
 * Stable integration boundary for the planetary scene.
 * The legacy renderer remains the visual baseline; new domains stay dormant
 * until reviewed runtime implementations are explicitly attached.
 */
export function createEarthCore(options = {}) {
  const implementation = createEarth(options);
  const updatePipeline = createEarthUpdatePipeline(EARTH_UPDATE_MODULES);
  let disposed = false;

  const core = {
    group: implementation.group,
    version: '1.1.0',
    referencePolicy: EARTH_REFERENCE_POLICY,
    references: EARTH_REFERENCE_SOURCES,
    updateModules: EARTH_UPDATE_MODULES,
    attachUpdateModule(id, runtime) {
      if (disposed) return false;
      return updatePipeline.attach(id, runtime);
    },
    update(delta) {
      if (disposed) return;
      implementation.update(delta);
      updatePipeline.update(delta, { group: core.group, options });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      updatePipeline.dispose();
      implementation.dispose();
    },
    getStatus() {
      return {
        core: 'ready',
        version: core.version,
        renderer: 'legacy-earth-adapter',
        referencesAreAdvisory: true,
        updateModules: updatePipeline.getStatus(),
        disposed
      };
    }
  };

  core.group.name = 'StarFrontier-Earth-Core';
  return core;
}
