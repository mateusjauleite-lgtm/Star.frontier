import * as THREE from 'three';

export function createLightingRuntime({ group, options, layers }) {
  let key, fill;
  return {
    initialize() {
      key = new THREE.DirectionalLight(0xfff1d9, 2.0);
      key.position.set(-options.radius * 5, options.radius * 1.8, options.radius * 4);
      key.name = 'Earth-New-Sunlight';
      key.target = layers.surface;
      group.add(key);
      fill = new THREE.AmbientLight(0x263b59, .22);
      fill.name = 'Earth-New-NightFill';
      group.add(fill);
      layers.lighting = { key, fill };
    },
    update() {},
    dispose() { if (key) group.remove(key); if (fill) group.remove(fill); }
  };
}
