import * as THREE from 'three';

const CONTINENTS = [
  // América do Norte (incluindo Alasca e Canadá)
  [[-168,65],[-164,60],[-153,58],[-145,60],[-139,59],[-135,56],[-130,54],[-128,50],[-124,48],[-123,42],[-117,32],[-111,31],[-106,31],[-103,28],[-97,25],[-97,19],[-91,18],[-87,21],[-84,25],[-81,25],[-80,30],[-77,34],[-75,38],[-71,41],[-69,44],[-65,45],[-61,49],[-59,53],[-62,57],[-66,60],[-72,63],[-76,67],[-83,70],[-91,72],[-101,74],[-112,74],[-122,72],[-130,70],[-140,69],[-151,70],[-160,70]],
  // América Central
  [[-92,18],[-88,17],[-86,15],[-84,11],[-82,9],[-79,9],[-77,7],[-80,13],[-83,16],[-87,18]],
  // América do Sul
  [[-81,12],[-77,8],[-73,10],[-70,11],[-66,10],[-62,9],[-58,6],[-53,4],[-50,1],[-48,-5],[-44,-3],[-41,-9],[-36,-11],[-38,-17],[-42,-22],[-48,-27],[-50,-32],[-54,-35],[-58,-38],[-62,-42],[-66,-50],[-69,-55],[-73,-51],[-75,-44],[-73,-35],[-77,-27],[-78,-18],[-80,-8]],
  // Europa e Ásia (Eurásia)
  [[-10,36],[-9,43],[-5,48],[2,51],[8,54],[14,55],[20,60],[28,60],[35,66],[45,68],[55,65],[65,68],[75,72],[90,73],[105,70],[120,66],[135,60],[150,59],[163,62],[178,55],[170,48],[160,45],[150,42],[143,38],[137,34],[130,31],[125,25],[120,20],[115,15],[110,10],[105,5],[100,8],[95,15],[90,21],[85,22],[80,8],[75,10],[70,20],[65,25],[58,27],[52,33],[48,39],[42,42],[36,40],[30,37],[25,40],[20,39],[15,42],[10,44],[5,43],[0,40],[-5,40]],
  // África
  [[-17,35],[0,37],[10,37],[25,32],[33,30],[35,22],[43,12],[51,11],[49,2],[43,-2],[41,-12],[35,-22],[32,-29],[25,-34],[18,-35],[12,-28],[10,-17],[5,-5],[-1,5],[-8,12],[-15,20],[-17,29]],
  // Península Arábica
  [[35,31],[43,30],[50,25],[56,20],[52,15],[45,12],[42,17],[38,22]],
  // Índia
  [[68,24],[72,29],[78,31],[85,26],[89,21],[86,15],[81,8],[77,7],[73,14]],
  // Sudeste Asiático continental
  [[92,22],[100,20],[107,17],[109,12],[106,8],[102,5],[98,8],[95,14]],
  // Indonésia e ilhas principais
  [[95,5],[105,4],[114,-3],[121,-5],[130,-4],[135,-7],[128,-9],[118,-8],[110,-7],[104,-5]],
  // Japão
  [[130,32],[132,35],[136,38],[140,41],[144,44],[146,41],[142,36],[138,33],[134,31]],
  // Austrália
  [[113,-11],[117,-14],[123,-16],[128,-14],[133,-12],[137,-13],[142,-11],[146,-16],[151,-24],[153,-29],[149,-36],[144,-39],[137,-36],[130,-34],[124,-32],[118,-29],[114,-23]],
  // Groenlândia
  [[-52,83],[-42,82],[-28,78],[-22,72],[-30,65],[-38,60],[-48,59],[-55,63],[-60,70],[-58,77]],
  // Madagascar
  [[49,-12],[50,-16],[49,-21],[46,-25],[44,-19]],
  // Reino Unido e Irlanda
  [[-10,55],[-8,58],[-5,59],[-3,57],[-2,53],[-5,50],[-8,52]],
  [[-10,51],[-7,52],[-6,55],[-8,55]],
  // Nova Zelândia
  [[172,-34],[176,-38],[178,-42],[174,-46],[168,-44],[166,-40]],
  [[173,-41],[176,-43],[170,-47],[167,-46]]
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

  // Calotas polares: Ártico e Antártida, sem transformar as latitudes em continentes.
  ctx.fillStyle = 'rgba(225,239,235,0.94)';
  ctx.beginPath();
  ctx.ellipse(1024, 13, 1024, 25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(1024, 1010, 1024, 30, 0, 0, Math.PI * 2);
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
  const radius = options.radius ?? 78;
  const position = options.position ?? [0, 0, -240];
  const group = new THREE.Group();
  group.name = 'StarFrontier-Earth';
  group.position.set(position[0], position[1], position[2]);

  const surfaceTexture = makeSurfaceTexture();
  const cloudTexture = makeCloudTexture();

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 128, 80),
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
    new THREE.SphereGeometry(radius * 1.008, 96, 64),
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
    new THREE.SphereGeometry(radius * 1.065, 96, 64),
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
