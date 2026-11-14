import * as THREE from 'three';

const LAND = [
  [[-168, 70], [-145, 72], [-125, 58], [-124, 42], [-106, 30], [-97, 18], [-82, 9], [-77, 25], [-60, 48], [-80, 68], [-110, 78]],
  [[-81, 12], [-68, 10], [-50, -2], [-35, -10], [-42, -24], [-52, -36], [-68, -56], [-78, -28]],
  [[-12, 36], [8, 55], [34, 70], [70, 72], [105, 68], [145, 58], [170, 48], [145, 34], [120, 8], [100, 5], [78, 25], [58, 28], [42, 12], [30, 35], [12, 42]],
  [[-18, 35], [10, 38], [38, 22], [50, 8], [38, -18], [24, -35], [10, -34], [-4, -5], [-16, 12]],
  [[112, -11], [154, -14], [153, -38], [132, -44], [114, -31]],
  [[-52, 82], [-24, 78], [-40, 58], [-60, 64]],
  [[45, -13], [51, -18], [47, -26], [43, -20]],
  [[130, 32], [145, 44], [143, 34]],
  [[166, -35], [178, -42], [170, -47], [166, -40]],
  [[-180, -72], [-150, -70], [-120, -73], [-90, -72], [-60, -74], [-30, -71], [0, -75], [30, -72], [60, -73], [90, -72], [120, -70], [150, -68], [180, -72], [180, -90], [-180, -90]]
];

function makeAlbedo() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048; canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const sea = ctx.createLinearGradient(0, 0, 0, 1024);
  sea.addColorStop(0, '#183f68'); sea.addColorStop(.5, '#08749b'); sea.addColorStop(1, '#102f55');
  ctx.fillStyle = sea; ctx.fillRect(0, 0, 2048, 1024);
  for (let i = 0; i < LAND.length; i++) {
    const polygon = LAND[i];
    ctx.beginPath();
    polygon.forEach(([lon, lat], n) => {
      const x = (lon + 180) / 360 * 2048;
      const y = (90 - lat) / 180 * 1024;
      n ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    const land = ctx.createLinearGradient(0, 120, 0, 950);
    land.addColorStop(0, '#c3c7a0'); land.addColorStop(.25, '#648c57');
    land.addColorStop(.65, '#39734b'); land.addColorStop(1, '#b4a47b');
    ctx.fillStyle = land; ctx.fill();
    ctx.strokeStyle = 'rgba(224,226,190,.55)'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.fillStyle = 'rgba(235,244,241,.92)';
  ctx.fillRect(0, 0, 2048, 16);
  return canvas;
}

export function createSurfaceRuntime({ group, options, layers }) {
  let mesh, texture, geometry, material;
  return {
    initialize() {
      texture = new THREE.CanvasTexture(makeAlbedo());
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      geometry = new THREE.SphereGeometry(options.radius, 160, 112);
      material = new THREE.MeshStandardMaterial({ map: texture, roughness: .94, metalness: 0 });
      mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'Earth-New-Surface';
      mesh.rotation.z = THREE.MathUtils.degToRad(11.5);
      group.add(mesh);
      layers.surface = mesh;
    },
    update(delta) { if (mesh) mesh.rotation.y += Math.min(Math.max(delta || 0, 0), .1) * .012; },
    dispose() {
      if (mesh) group.remove(mesh);
      geometry?.dispose(); material?.dispose(); texture?.dispose();
    }
  };
}
