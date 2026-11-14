import { createEarth } from '../earth.js';
import { EARTH_REFERENCE_POLICY, EARTH_REFERENCE_SOURCES } from './references/index.js';

/**
 * Stable integration boundary for the planetary scene.
 * References are advisory only and never modify runtime assets automatically.
 */
export function createEarthCore(options = {}) {
  const implementation = createEarth(options);
  let disposed = false;

  const core = {
    group: implementation.group,
    version: '1.0.0',
    referencePolicy: EARTH_REFERENCE_POLICY,
    references: EARTH_REFERENCE_SOURCES,
    update(delta) {
      if (!disposed) implementation.update(delta);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      implementation.dispose();
    },
    getStatus() {
      return {
        core: 'ready',
        version: core.version,
        renderer: 'legacy-earth-adapter',
        referencesAreAdvisory: true,
        disposed
      };
    }
  };

  core.group.name = 'StarFrontier-Earth-Core';
  return core;
}
