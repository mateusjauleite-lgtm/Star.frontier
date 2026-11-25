/**
 * Solar illumination is owned by the scene-level space lighting system.
 * This Earth module intentionally contributes no second directional source;
 * it only publishes the ownership contract for status/diagnostics.
 */
export function createBlueMarbleLightingRuntime({ layers }) {
  let disposed = false;
  return {
    initialize() {
      layers.lighting = {
        owner: 'scene-space-lighting',
        directSolarSource: 'single-scene-directional-light',
        nightFillOwner: 'scene-space-lighting'
      };
    },
    update() {},
    dispose() {
      if (disposed) return;
      disposed = true;
      if (layers.lighting?.owner === 'scene-space-lighting') {
        delete layers.lighting;
      }
    }
  };
}
