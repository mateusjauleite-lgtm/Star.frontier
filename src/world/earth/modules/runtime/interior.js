import * as THREE from 'three';

// Mean Earth reference radii (km), converted to the configured game radius.
// The crust is visually thickened slightly so its boundary remains legible.
const INTERIOR_BOUNDARIES = Object.freeze([
  { id: 'inner-core', label: 'Núcleo interno', radiusKm: 1221, color: 0xffd27a, opacity: 0.13 },
  { id: 'outer-core', label: 'Núcleo externo', radiusKm: 3480, color: 0xe77b45, opacity: 0.095 },
  { id: 'mantle', label: 'Manto', radiusKm: 6346, color: 0xc65d43, opacity: 0.075 },
  { id: 'crust', label: 'Crosta', radiusKm: 6371, color: 0xd9b77c, opacity: 0.12 }
]);

export function createInteriorRuntime({ group, options, layers }) {
  const meshes = [];

  return {
    initialize() {
      const radius = options.radius;
      for (const boundary of INTERIOR_BOUNDARIES) {
        const physicalRatio = boundary.radiusKm / 6371;
        const visualRadius = radius * physicalRatio +
          (boundary.id === 'crust' ? Math.max(0.8, radius * 0.003) : 0);
        const geometry = new THREE.SphereGeometry(visualRadius, 96, 64);
        const material = new THREE.MeshBasicMaterial({
          color: boundary.color,
          side: THREE.BackSide,
          transparent: true,
          opacity: boundary.opacity,
          depthWrite: false,
          blending: THREE.NormalBlending
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = 'Earth-Interior-' + boundary.id;
        mesh.renderOrder = 2;
        mesh.userData.earthInterior = {
          id: boundary.id,
          label: boundary.label,
          referenceRadiusKm: boundary.radiusKm,
          visualRadius,
          physicalRadiusRatio: physicalRatio
        };
        group.add(mesh);
        meshes.push({ mesh, geometry, material });
        layers['interior-' + boundary.id] = mesh;
      }
      layers.interior = meshes.map(item => item.mesh);
    },
    update() {},
    dispose() {
      for (const item of meshes) {
        group.remove(item.mesh);
        item.geometry.dispose();
        item.material.dispose();
      }
      meshes.length = 0;
    }
  };
}
