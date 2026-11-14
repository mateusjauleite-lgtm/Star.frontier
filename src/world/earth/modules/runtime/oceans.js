import * as THREE from 'three';

export function createOceansRuntime({ group, options, layers }) {
  let mesh, geometry, material;
  return {
    initialize() {
      geometry = new THREE.SphereGeometry(options.radius * 1.0011, 128, 96);
      material = new THREE.MeshPhysicalMaterial({
        color: 0x6aaec2, roughness: .34, metalness: .02,
        clearcoat: .35, clearcoatRoughness: .3,
        transparent: true, opacity: .055, depthWrite: false
      });
      mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'Earth-New-Ocean-Sheen';
      mesh.rotation.copy(layers.surface.rotation);
      group.add(mesh);
      layers.oceans = mesh;
    },
    update() { if (mesh && layers.surface) mesh.rotation.copy(layers.surface.rotation); },
    dispose() { if (mesh) group.remove(mesh); geometry?.dispose(); material?.dispose(); }
  };
}
