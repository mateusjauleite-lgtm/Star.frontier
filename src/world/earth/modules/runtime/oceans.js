// Oceans are rendered as the opaque blue-water region of the solid surface
// albedo. A transparent full-sphere overlay made the entire planet look gaseous.
export function createOceansRuntime({ layers }) {
  return {
    initialize() {
      layers.oceans = {
        integratedWith: 'surface',
        appearance: 'opaque-blue-water',
        transparentGlobalOverlay: false
      };
    },
    update() {},
    dispose() {}
  };
}
