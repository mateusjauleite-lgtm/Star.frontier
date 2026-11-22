import * as THREE from 'three';

/** One neutral solar key and a restrained night-side fill for the new Earth. */
export function createBlueMarbleLightingRuntime({ group, options, layers }) {
  let sunlight = null;
  let nightFill = null;
  let disposed = false;

  return {
    initialize() {
      sunlight = new THREE.DirectionalLight(0xffffff, 1.85);
      sunlight.position.set(
        -options.radius * 5,
        options.radius * 1.8,
        options.radius * 4
      );
      sunlight.name = 'Earth-Blue-Marble-Sunlight';
      if (layers.surface) sunlight.target = layers.surface;
      group.add(sunlight);

      nightFill = new THREE.AmbientLight(0x142b48, 0.12);
      nightFill.name = 'Earth-Blue-Marble-NightFill';
      group.add(nightFill);

      layers.lighting = { sunlight, nightFill };
    },
    update() {},
    dispose() {
      if (disposed) return;
      disposed = true;
      if (sunlight) {
        group.remove(sunlight);
        if (sunlight.target) group.remove(sunlight.target);
      }
      if (nightFill) group.remove(nightFill);
    }
  };
}
