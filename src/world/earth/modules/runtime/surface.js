import * as THREE from 'three';

export const EARTH_LAND_POLYGONS = [
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

function traceLand(ctx, width, height) {
  for (const polygon of EARTH_LAND_POLYGONS) {
    ctx.beginPath();
    polygon.forEach(([lon, lat], index) => {
      const x = (lon + 180) / 360 * width;
      const y = (90 - lat) / 180 * height;
      index ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
  }
}

export function createEarthLandMask(width = 1024, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#fff';
  traceLand(ctx, width, height);
  ctx.fill();
  return canvas;
}

function makeAlbedo() {
  const width = 2048, height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');

  const ocean = ctx.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, '#17466b');
  ocean.addColorStop(.48, '#075078');
  ocean.addColorStop(1, '#102f50');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, width, height);

  // Fine, restrained ocean variation: avoids a flat or translucent-glass look.
  for (let i = 0; i < 5200; i++) {
    const x = (i * 7919) % width;
    const y = (i * 3571) % height;
    ctx.fillStyle = i % 3 ? 'rgba(82,151,177,.055)' : 'rgba(2,20,39,.07)';
    ctx.beginPath();
    ctx.ellipse(x, y, 3 + (i % 17), 1 + (i % 3), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let p = 0; p < EARTH_LAND_POLYGONS.length; p++) {
    const polygon = EARTH_LAND_POLYGONS[p];
    ctx.beginPath();
    polygon.forEach(([lon, lat], index) => {
      const x = (lon + 180) / 360 * width;
      const y = (90 - lat) / 180 * height;
      index ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();

    const land = ctx.createLinearGradient(0, 80, 0, 950);
    land.addColorStop(0, '#a6a78b');
    land.addColorStop(.18, '#687b4e');
    land.addColorStop(.42, '#527544');
    land.addColorStop(.7, '#806c48');
    land.addColorStop(1, '#d0d0c0');
    ctx.fillStyle = land;
    ctx.fill();
    ctx.save();
    ctx.clip();

    // Deterministic geological mottling and rocky highland patches.
    for (let i = 0; i < 420; i++) {
      const x = ((i * 127 + p * 313) % 1000) / 1000 * width;
      const y = ((i * 233 + p * 97) % 1000) / 1000 * height;
      const r = 2 + ((i * 19) % 15);
      ctx.fillStyle = i % 4 === 0 ? 'rgba(183,157,111,.16)' :
        i % 4 === 1 ? 'rgba(27,55,35,.13)' :
        i % 4 === 2 ? 'rgba(222,211,169,.12)' : 'rgba(95,75,48,.12)';
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.8, r, (i % 7) * .2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Broken, branching strokes suggest ridges and exposed rock without a gas-like haze.
    ctx.lineCap = 'round';
    for (let i = 0; i < 34; i++) {
      const x = ((i * 173 + p * 211) % 1000) / 1000 * width;
      const y = ((i * 317 + p * 149) % 1000) / 1000 * height;
      ctx.strokeStyle = i % 2 ? 'rgba(54,61,43,.23)' : 'rgba(229,207,159,.2)';
      ctx.lineWidth = 1 + (i % 3);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 12 + (i % 19), y - 5 - (i % 13));
      ctx.lineTo(x + 22 + (i % 27), y + 3 + (i % 9));
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(211,211,181,.72)';
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }

  // Polar ice caps are part of the solid surface texture.
  ctx.fillStyle = 'rgba(226,237,231,.92)';
  ctx.fillRect(0, 0, width, 12);
  ctx.fillStyle = 'rgba(215,229,226,.82)';
  ctx.fillRect(0, height - 30, width, 30);
  return canvas;
}

export function createSurfaceRuntime({ group, options, layers }) {
  let mesh, texture, geometry, material;
  return {
    initialize() {
      texture = new THREE.CanvasTexture(makeAlbedo());
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      geometry = new THREE.SphereGeometry(options.radius, 192, 128);
      material = new THREE.MeshStandardMaterial({
        map: texture, roughness: .86, metalness: .015
      });
      mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'Earth-New-Solid-Surface';
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
