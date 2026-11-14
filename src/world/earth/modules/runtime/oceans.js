// Ocean basins are part of the continuous rocky body.
// This module deliberately creates no water mesh, shader, or blue overlay.
export function createOceansRuntime({ layers }) {
  return {
    initialize() {
      layers.oceans = {
        integratedWith: 'surface',
        appearance: 'dry-rocky-ocean-basins',
        waterGeometry: false,
        waterMaterial: false,
        bathymetryRelief: 'integrated-into-rock-mesh'
      };
    },
    update() {},
    dispose() {}
  };
}
