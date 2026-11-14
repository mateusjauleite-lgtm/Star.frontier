import * as THREE from 'three';
import { createEarthLandMask } from './surface.js';

const smoothstep = (edge0, edge1, value) => {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export function createTerrainRuntime({ options, layers }) {
  let maskCanvas, maskData;
  return {
    initialize() {
      const surface = layers.surface;
      if (!surface?.geometry) return;

      maskCanvas = createEarthLandMask(2048, 1024);
      const context = maskCanvas.getContext('2d');
      maskData = context.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;

      const geometry = surface.geometry;
      const positions = geometry.attributes.position;
      const uv = geometry.attributes.uv;
      const direction = new THREE.Vector3();
      const radius = options.radius;
      const width = maskCanvas.width;
      const height = maskCanvas.height;

      for (let i = 0; i < positions.count; i++) {
        const u = uv.getX(i);
        const v = uv.getY(i);
        const px = Math.min(width - 1, Math.max(0, Math.floor(u * (width - 1))));
        const py = Math.min(height - 1, Math.max(0, Math.floor((1 - v) * (height - 1))));
        const landSample = maskData[(py * width + px) * 4] / 255;
        const land = smoothstep(.08, .92, landSample);

        direction.fromBufferAttribute(positions, i).normalize();
        const latitude = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1));
        const longitude = Math.atan2(direction.z, direction.x);

        // Large-scale plateaus and broad plains.
        const continentalShape =
          Math.sin(longitude * 2.35 + Math.sin(latitude * 3.7) * .72) *
          Math.cos(latitude * 5.4 - longitude * .86);
        const plateau = Math.max(0, continentalShape * .5 + .5);
        const plainVariation =
          Math.sin(longitude * 13.1 + Math.sin(latitude * 8.2)) *
          Math.cos(latitude * 17.3 - longitude * 3.1);

        // Mountain belts are elongated, not isolated holes or random spikes.
        const tectonicWave =
          Math.sin(longitude * 5.1 + Math.sin(latitude * 7.4) * 1.35) *
          Math.cos(latitude * 9.2 - longitude * 1.8);
        const mountainBelt = Math.pow(Math.max(0, 1 - Math.abs(tectonicWave)), 3.2);
        const highland = Math.pow(Math.max(0, plateau - .58), 1.7);
        const fineRock =
          Math.sin(longitude * 39 + latitude * 23) *
          Math.cos(latitude * 47 - longitude * 17);

        const oceanFloorWave =
          Math.sin(longitude * 4.3 + Math.sin(latitude * 2.8)) *
          Math.cos(latitude * 6.1 - longitude * 1.4);
        const oceanTrench = Math.pow(Math.max(0, 1 - Math.abs(oceanFloorWave)), 4);

        const continentalElevation = radius * (
          .0010 +
          plateau * .0011 +
          mountainBelt * .0085 +
          highland * .0022 +
          plainVariation * .00022 +
          fineRock * .00012
        );
        const oceanicElevation = -radius * (
          .0030 +
          oceanTrench * .0018 +
          Math.abs(oceanFloorWave) * .00045
        );

        // A narrow coast transition joins continents and exposed oceanic crust.
        const elevation = THREE.MathUtils.lerp(oceanicElevation, continentalElevation, land);
        const finalRadius = radius + elevation;
        positions.setXYZ(
          i,
          direction.x * finalRadius,
          direction.y * finalRadius,
          direction.z * finalRadius
        );
      }

      positions.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      surface.name = 'Earth-Rock-Mass-Continents-And-Dry-Ocean-Basins';
      layers.terrain = {
        integratedWith: 'surface',
        landMask: true,
        displacedVertices: positions.count,
        relief: 'continuous-rocky-continents-and-submerged-basin-topography',
        waterGeometry: false,
        landingPlains: 'broad-low-relief-regions'
      };
    },
    update() {},
    dispose() {
      maskCanvas = null;
      maskData = null;
    }
  };
}
