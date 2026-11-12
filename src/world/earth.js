import * as THREE from 'three';

const CONTINENTS = [
  // América do Norte
  [[-168,70],[-145,72],[-128,62],[-118,55],[-125,48],[-123,40],[-116,32],[-108,28],[-100,20],[-90,18],[-84,25],[-80,30],[-74,42],[-60,48],[-62,58],[-82,66],[-105,72],[-130,70]],
  // América Central
  [[-98,20],[-92,18],[-88,15],[-84,10],[-78,8],[-82,16],[-88,20]],
  // América do Sul
  [[-81,12],[-70,10],[-62,8],[-51,2],[-45,-5],[-39,-14],[-47,-23],[-52,-33],[-66,-55],[-72,-48],[-75,-30],[-80,-8]],
  // Europa e Ásia
  [[-10,36],[-9,44],[2,50],[12,55],[25,60],[40,58],[55,65],[75,70],[95,72],[120,65],[145,58],[160,60],[178,52],[160,42],[145,38],[135,30],[122,22],[110,10],[100,5],[90,20],[78,8],[68,22],[55,25],[48,38],[38,42],[28,36],[18,40],[10,36],[0,38]],
  // África
  [[-17,35],[5,37],[30,31],[43,12],[50,2],[40,-12],[32,-28],[18,-35],[12,-25],[5,-5],[-5,5],[-15,15]],
  // Índia e sudeste asiático
  [[67,25],[78,30],[90,22],[88,10],[80,5],[73,10]],
  [[96,20],[108,18],[120,8],[130,5],[125,-8],[112,-10],[103,0]],
  // Japão e ilhas principais
  [[130,34],[138,42],[145,44],[143,34],[137,30]],
  // Austrália
  [[112,-11],[130,-10],[145,-15],[154,-27],[146,-39],[130,-36],[115,-27]],
  // Groenlândia
  [[-52,82],[-25,78],[-34,60],[-48,58],[-60,68]],
  // Madagascar
  [[47,-13],[50,-17],[49,-25],[45,-22]],
  // Reino Unido
  [[-8,58],[-3,59],[0,52],[-5,50],[-7,54]]
];

function makeSurfaceTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  const ocean = ctx.createLinearGradient(0, 0, 0, canvas.height);
  ocean.addColorStop(0, '#123d72');
  ocean.addColorStop(0.48, '#0874a5');
  ocean.addColorStop(1, '#082b58');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Faixas oceânicas suaves para dar profundidade sem poluir a textura.
  for (let i = 0; i < 90; i++) {
    const y = (i / 90) * canvas.height;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(92,190,220,0.055)' : 'rgba(0,18,55,0.045)';
    ctx.lineWidth = 2 + (i % 4);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(520, y - 18, 1300, y + 16, canvas.width, y - 8);
    ctx.stroke();
  }

  for (let index = 0; index < CONTINENTS.length; index++) {
    const points = CONTINENTS[index];
    ctx.beginPath();
    points.forEach(([lon, lat], i) => {
      const x = ((lon + 180) / 360) * canvas.width;
      const y = ((90 - lat) / 180) * canvas.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();

    const land = ctx.createLinearGradient(0, 120, 0, 900);
    land.addColorStop(0, '#c5d3a0');
    land.addColorStop(0.28, '#5d9b58');
    land.addColorStop(0.62, '#397b49');
    land.addColorStop(1, '#a9a17b');
    ctx.fillStyle = land;
    ctx.fill();

    ctx.strokeStyle = 'rgba(205,220,170,0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Variação de terreno discreta dentro de cada massa continental.
    ctx.save();
    ctx.clip();
    for (let j = 0; j < 34; j++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      ctx.fillStyle = j % 2 ? 'rgba(190,166,105,0.075)' : 'rgba(18,75,48,0.07)';
      ctx.beginPath();
      ctx.ellipse(x, y, 18 + Math.random() * 65, 5 + Math.random() * 20, Math.random(), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Regiões polares.
  ctx.fillStyle = 'rgba(225,239,235,0.94)';
  ctx.beginPath();
  ctx.ellipse(1024, 15, 1024, 42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(1024, 1008, 1024, 34, 0, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeCloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Nuvens em faixas curvas, com transparência para revelar os continentes.
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * canvas.width;
    const y = 70 + Math.random() * 880;
    const length = 25 + Math.random() * 150;
    const height = 3 + Math.random() * 13;
    ctx.fillStyle = `rgba(242,249,255,${0.025 + Math.random() * 0.11})`;
    ctx.beginPath();
    ctx.ellipse(x, y, length, height, (Math.random() - 0.5) * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Cria a Terra como um grupo independente para ser adicionado à cena Three.js.
 * Retorna { group, update, dispose }.
 */
export function createEarth(options = {}) {
  const radius = options.radius ?? 48;
  const position = options.position ?? [0, 0, -240];
  const group = new THREE.Group();
  group.name = 'StarFrontier-Earth';
  group.position.set(position[0], position[1], position[2]);

  const surfaceTexture = makeSurfaceTexture();
  const cloudTexture = makeCloudTexture();

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 96, 64),
    new THREE.MeshStandardMaterial({
      map: surfaceTexture,
      roughness: 0.92,
      metalness: 0,
      bumpMap: surfaceTexture,
      bumpScale: 0.22
    })
  );
  earth.name = 'Earth-Surface';
  earth.rotation.z = THREE.MathUtils.degToRad(12);
  group.add(earth);

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.006, 72, 48),
    new THREE.MeshStandardMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      roughness: 1
    })
  );
  clouds.name = 'Earth-Clouds';
  clouds.rotation.z = earth.rotation.z;
  group.add(clouds);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.075, 72, 48),
    new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          float rim = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewPosition)), 0.0), 2.5);
          vec3 blue = vec3(0.16, 0.55, 1.0);
          gl_FragColor = vec4(blue, rim * 0.58);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false
    })
  );
  atmosphere.name = 'Earth-Atmosphere';
  group.add(atmosphere);

  const sunlight = new THREE.DirectionalLight(0xfff0d8, 2.15);
  const sunDirection = options.sunDirection ?? [-1, 0.35, 0.8];
  sunlight.position.set(
    sunDirection[0] * radius * 5,
    sunDirection[1] * radius * 5,
    sunDirection[2] * radius * 5
  );
  sunlight.target = earth;
  group.add(sunlight);

  const ambient = new THREE.AmbientLight(0x263d62, 0.28);
  group.add(ambient);

  return {
    group,
    update(delta) {
      const step = Math.min(Math.max(delta || 0, 0), 0.1);
      earth.rotation.y += step * 0.018;
      clouds.rotation.y += step * 0.024;
    },
    dispose() {
      group.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
      surfaceTexture.dispose();
      cloudTexture.dispose();
    }
  };
}
