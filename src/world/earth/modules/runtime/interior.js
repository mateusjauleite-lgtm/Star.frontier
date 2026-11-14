import * as THREE from 'three';

// Mean Earth reference radii (km), converted to the configured game radius.
// Interior boundaries are opt-in so they never tint the exterior planet.
const INTERIOR_BOUNDARIES = Object.freeze([
  { id: 'inner-core', label: 'Núcleo interno', radiusKm: 1221, color: 0xffd27a, opacity: 0.22 },
  { id: 'outer-core', label: 'Núcleo externo', radiusKm: 3480, color: 0xe77b45, opacity: 0.18 },
  { id: 'mantle', label: 'Manto', radiusKm: 6346, color: 0xc65d43, opacity: 0.14 },
  { id: 'crust', label: 'Crosta', radiusKm: 6371, color: 0xd9b77c, opacity: 0.2 }
]);

export function createInteriorRuntime({ group, options, layers }) {
  const meshes = [];
  return {
    initialize() {
      // External view is the default. Enable with showInterior: true for inspection.
      if (options.showInterior !== true) {
        layers.interior = [];
        layers.interiorVisibility = 'hidden-exterior-view';
        return;
      }

      const radius = options.radius;
      for (const boundary of INTERIOR_BOUNDARIES) {
        const physicalRatio = boundary.radiusKm / 6371;
        const visualRadius = radius * physicalRatio +
          (boundary.id === 'crust' ? Math.max(0.8, radius * 0.003) : 0);
        const geometry = new THREE.SphereGeometry(visualRadius, 96, 64);
        const material = new THREE.MeshBasicMaterial({
          color: boundary.color, side: THREE.BackSide, transparent: true,
          opacity: boundary.opacity, depthWrite: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = 'Earth-Interior-' + boundary.id;
        mesh.renderOrder = 2;
        mesh.userData.earthInterior = {
          id: boundary.id, label: boundary.label,
          referenceRadiusKm: boundary.radiusKm, visualRadius,
          physicalRadiusRatio: physicalRatio
        };
        group.add(mesh);
        meshes.push({ mesh, geometry, material });
        layers['interior-' + boundary.id] = mesh;
      }
      layers.interior = meshes.map(item => item.mesh);
      layers.interiorVisibility = 'inspection-view';
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
