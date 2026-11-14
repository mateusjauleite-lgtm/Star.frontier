import * as THREE from 'three';

function makeCloudMap() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048; canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 620; i++) {
    const x = Math.random() * canvas.width, y = 70 + Math.random() * 880;
    ctx.fillStyle = `rgba(248,252,255,${.025 + Math.random() * .12})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 18 + Math.random() * 110, 3 + Math.random() * 12, (Math.random() - .5) * .35, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

export function createCloudsRuntime({ group, options, layers }) {
  let mesh, geometry, material, texture;
  return {
    initialize() {
      texture = new THREE.CanvasTexture(makeCloudMap());
      texture.colorSpace = THREE.SRGBColorSpace;
      geometry = new THREE.SphereGeometry(options.radius * 1.007, 128, 88);
      material = new THREE.MeshStandardMaterial({ map: texture, transparent: true, opacity: .34, roughness: 1, depthWrite: false });
      mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'Earth-New-Cloud-Cover';
      mesh.rotation.copy(layers.surface.rotation);
      group.add(mesh); layers.clouds = mesh;
    },
    update(delta) { if (mesh) mesh.rotation.y += Math.min(Math.max(delta || 0, 0), .1) * .008; },
    dispose() { if (mesh) group.remove(mesh); geometry?.dispose(); material?.dispose(); texture?.dispose(); }
  };
}
