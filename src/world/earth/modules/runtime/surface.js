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
  ctx.beginPath();
  for (const polygon of EARTH_LAND_POLYGONS) {
    polygon.forEach(([lon, lat], index) => {
      const x = (lon + 180) / 360 * width;
      const y = (90 - lat) / 180 * height;
      index ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
  }
}

export function createEarthLandMask(width = 2048, height = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#fff';
  traceLand(ctx, width, height);
  ctx.fill();
  return canvas;
}

function makeRockAlbedo() {
  const width = 2048, height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Ocean basins remain exposed rock: no blue water, transparency or water shader.
  const basin = ctx.createLinearGradient(0, 0, 0, height);
  basin.addColorStop(0, '#343b40');
  basin.addColorStop(.5, '#242b30');
  basin.addColorStop(1, '#3a3935');
  ctx.fillStyle = basin;
  ctx.fillRect(0, 0, width, height);

  // Subtle geological variation across the dry oceanic crust.
  for (let i = 0; i < 9000; i++) {
    const x = (i * 7919) % width;
    const y = (i * 3571) % height;
    ctx.fillStyle = i % 3 ? 'rgba(151,137,117,.055)' : 'rgba(5,9,12,.11)';
    ctx.beginPath();
    ctx.ellipse(x, y, 3 + (i % 23), 1 + (i % 4), (i % 9) * .08, 0, Math.PI * 2);
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

    const rock = ctx.createLinearGradient(0, 70, 0, 970);
    rock.addColorStop(0, '#77766e');
    rock.addColorStop(.18, '#8b806c');
    rock.addColorStop(.42, '#746b5b');
    rock.addColorStop(.68, '#625c50');
    rock.addColorStop(1, '#8a8173');
    ctx.fillStyle = rock;
    ctx.fill();
    ctx.save();
    ctx.clip();

    // Mineral bands, weathered plateaus and exposed-rock mottling.
    for (let i = 0; i < 1250; i++) {
      const x = ((i * 127 + p * 313) % 1000) / 1000 * width;
      const y = ((i * 233 + p * 97) % 1000) / 1000 * height;
      const r = 2 + ((i * 19) % 22);
      const shade = i % 5;
      ctx.fillStyle = shade === 0 ? 'rgba(193,169,130,.18)' :
        shade === 1 ? 'rgba(30,34,34,.16)' :
        shade === 2 ? 'rgba(220,207,179,.11)' :
        shade === 3 ? 'rgba(104,77,55,.17)' : 'rgba(151,145,128,.12)';
      ctx.beginPath();
      ctx.ellipse(x, y, r * (1.4 + (i % 4) * .35), r * .65, (i % 7) * .2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Long, broken ridge marks; restrained enough to keep broad plains readable.
    ctx.lineCap = 'round';
    for (let i = 0; i < 110; i++) {
      const x = ((i * 173 + p * 211) % 1000) / 1000 * width;
      const y = ((i * 317 + p * 149) % 1000) / 1000 * height;
      ctx.strokeStyle = i % 2 ? 'rgba(37,39,37,.28)' : 'rgba(222,204,171,.22)';
      ctx.lineWidth = 1 + (i % 4);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 12 + (i % 29), y - 5 - (i % 17));
      ctx.lineTo(x + 25 + (i % 39), y + 4 + (i % 11));
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(190,177,151,.58)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  return canvas;
}

export function createSurfaceRuntime({ group, options, layers }) {
  let mesh, texture, geometry, material;
  return {
    initialize() {
      texture = new THREE.CanvasTexture(makeRockAlbedo());
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      geometry = new THREE.SphereGeometry(options.radius, 320, 192);
      material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: .96,
        metalness: .025
      });
      mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'Earth-Continuous-Rocky-Globe';
      mesh.rotation.z = THREE.MathUtils.degToRad(11.5);
      group.add(mesh);
      layers.surface = mesh;
    },
    update(delta) {
      if (mesh) mesh.rotation.y += Math.min(Math.max(delta || 0, 0), .1) * .012;
    },
    dispose() {
      if (mesh) group.remove(mesh);
      geometry?.dispose();
      material?.dispose();
      texture?.dispose();
    }
  };
}
