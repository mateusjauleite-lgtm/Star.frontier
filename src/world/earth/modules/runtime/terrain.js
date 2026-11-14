import * as THREE from 'three';
import { createEarthLandMask } from './surface.js';

export function createTerrainRuntime({ options, layers }) {
  let maskCanvas, maskData;
  return {
    initialize() {
      const surface = layers.surface;
      if (!surface?.geometry) return;
      maskCanvas = createEarthLandMask(1024, 512);
      const context = maskCanvas.getContext('2d');
      maskData = context.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;

      const geometry = surface.geometry;
      const positions = geometry.attributes.position;
      const uv = geometry.attributes.uv;
      const vertex = new THREE.Vector3();
      const radius = options.radius;

      for (let i = 0; i < positions.count; i++) {
        const u = uv.getX(i);
        const v = uv.getY(i);
        const px = Math.min(maskCanvas.width - 1, Math.max(0, Math.floor(u * (maskCanvas.width - 1))));
        const py = Math.min(maskCanvas.height - 1, Math.max(0, Math.floor((1 - v) * (maskCanvas.height - 1))));
        const land = maskData[(py * maskCanvas.width + px) * 4] / 255;
        vertex.fromBufferAttribute(positions, i).normalize();
        const lat = Math.asin(vertex.y);
        const lon = Math.atan2(vertex.z, vertex.x);
        const ridge = Math.max(0,
          Math.sin(lon * 8.7 + Math.sin(lat * 5.1) * 1.7) *
          Math.cos(lat * 13.2 - lon * 2.4) +
          Math.sin(lon * 27 + lat * 19) * .22
        ) ** 3;
        const elevation = land * (radius * (.0011 + ridge * .0032));
        positions.setXYZ(i, vertex.x * (radius + elevation), vertex.y * (radius + elevation), vertex.z * (radius + elevation));
      }

      positions.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      surface.name = 'Earth-Solid-Surface-With-Rocky-Relief';
      layers.terrain = { integratedWith: 'surface', landMask: true, displacedVertices: positions.count };
    },
    update() {},
    dispose() { maskCanvas = null; maskData = null; }
  };
}
