import * as THREE from 'three';

function createCloudMap() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  if (!context) return canvas;

  // Seeded clusters keep the cloud layout stable between launches.
  let seed = 0x5f3759df;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  for (let cluster = 0; cluster < 760; cluster += 1) {
    const centerX = random() * canvas.width;
    const centerY = 54 + random() * (canvas.height - 108);
    const width = 34 + random() * 112;
    const height = 5 + random() * 15;
    const rotation = (random() - 0.5) * 0.42;
    const puffs = 3 + Math.floor(random() * 5);

    for (let puff = 0; puff < puffs; puff += 1) {
      const x = centerX + (random() - 0.5) * width * 0.9;
      const y = centerY + (random() - 0.5) * height * 2.1;
      const alpha = 0.16 + random() * 0.28;
      context.fillStyle = `rgba(250, 253, 255, ${alpha})`;
      context.beginPath();
      context.ellipse(
        x,
        y,
        width * (0.13 + random() * 0.19),
        height * (0.32 + random() * 0.48),
        rotation,
        0,
        Math.PI * 2
      );
      context.fill();
    }
  }
  return canvas;
}

export function createCloudsRuntime({ surfaceFrame, options, layers }) {
  let mesh = null;
  let geometry = null;
  let material = null;
  let texture = null;
  let disposed = false;

  return {
    initialize() {
      texture = new THREE.CanvasTexture(createCloudMap());
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      geometry = new THREE.SphereGeometry(options.radius * 1.007, 128, 88);
      material = new THREE.MeshBasicMaterial({
        map: texture,
        color: 0xffffff,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        side: THREE.FrontSide
      });
      mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'Earth-Blue-Marble-Cloud-Cover';
      mesh.renderOrder = 2;
      surfaceFrame.add(mesh);
      layers.clouds = mesh;
      layers.cloudsVisual = {
        source: 'deterministic-procedural-cloud-map',
        enabled: true,
        followsTerrestrialFrame: true
      };
    },

    update(delta) {
      if (!mesh || disposed) return;
      const step = Math.min(Math.max(delta || 0, 0), 0.1);
      // Slow atmospheric drift relative to the rotating solid Earth.
      mesh.rotation.y += step * 0.00018;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      if (mesh) surfaceFrame.remove(mesh);
      geometry?.dispose();
      material?.dispose();
      texture?.dispose();
      if (layers.clouds === mesh) layers.clouds = null;
    }
  };
}
