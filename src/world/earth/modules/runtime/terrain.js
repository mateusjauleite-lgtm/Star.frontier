import * as THREE from 'three';

function ridge(lat, lon) {
  const bands = Math.sin(lon * 8.7 + Math.sin(lat * 5.1) * 1.7) *
    Math.cos(lat * 13.2 - lon * 2.4);
  const detail = Math.sin(lon * 27.0 + lat * 19.0) * .22;
  return Math.max(0, bands + detail) ** 3;
}

export function createTerrainRuntime({ group, options, layers }) {
  let mesh, geometry, material;
  return {
    initialize() {
      geometry = new THREE.SphereGeometry(options.radius * 1.0008, 192, 128);
      const positions = geometry.attributes.position;
      const vertex = new THREE.Vector3();
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i).normalize();
        const lat = Math.asin(vertex.y);
        const lon = Math.atan2(vertex.z, vertex.x);
        const elevation = ridge(lat, lon) * .24;
        positions.setXYZ(i, vertex.x * (options.radius + elevation), vertex.y * (options.radius + elevation), vertex.z * (options.radius + elevation));
      }
      geometry.computeVertexNormals();
      material = new THREE.MeshStandardMaterial({
        color: 0xffffff, transparent: true, opacity: .075,
        roughness: 1, metalness: 0, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -1
      });
      mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'Earth-New-Terrain-Relief';
      mesh.rotation.copy(layers.surface.rotation);
      group.add(mesh);
      layers.terrain = mesh;
    },
    update() {},
    dispose() { if (mesh) group.remove(mesh); geometry?.dispose(); material?.dispose(); }
  };
}
