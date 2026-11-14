// Cloud cover is intentionally disabled for the bare-rock construction pass.
// The independently modeled atmospheric layers remain active.
export function createCloudsRuntime({ layers }) {
  return {
    initialize() {
      layers.clouds = {
        enabled: false,
        reason: 'bare-rock-surface-pass',
        atmospherePreserved: true
      };
    },
    update() {},
    dispose() {}
  };
}
