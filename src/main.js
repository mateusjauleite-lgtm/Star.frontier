import * as THREE from 'three';
import { createEarth } from './world/earth.js';
import { createStation } from './world/station.js';
import { state } from './core/state.js';
import { saveState as save, loadState as load } from './core/storage.js';

const $ = id => document.getElementById(id);

load();

/* UTILITÁRIOS */

function show(id) {
  ['login-screen', 'menu-screen', 'game-screen'].forEach(name => {
    $(name)?.classList.add('hidden');
  });

  $(id)?.classList.remove('hidden');
}

function toast(message) {
  const el = $('toast');
  if (!el) return;

  el.textContent = message;
  el.classList.remove('hidden');

  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    el.classList.add('hidden');
  }, 2400);
}

function updateWallet() {
  const credits = state.credits.toLocaleString('pt-BR');

  if ($('menu-credits')) $('menu-credits').textContent = credits;
  if ($('hud-credits')) $('hud-credits').textContent = credits;
  if ($('hud-user')) $('hud-user').textContent = state.user || 'PILOTO';
}

/* LOGIN E PERFIL */

$('login-btn')?.addEventListener('click', () => {
  const name = $('login-name')?.value.trim();
  const pass = $('login-pass')?.value;
  const email = $('login-email')?.value.trim();

  if (!name || !pass) {
    alert('Informe seu nome e sua senha.');
    return;
  }

  state.user = name.slice(0, 18);
  state.email = email || '';
  state.country = $('country')?.value || 'Brasil';

  save();
  updateWallet();
  show('menu-screen');
  renderPanel('play');
});

$('forgot-btn')?.addEventListener('click', () => {
  alert('A recuperação de senha será adicionada quando houver um servidor de contas.');
});

$('logout-btn')?.addEventListener('click', () => {
  save();
  show('login-screen');
});

if (state.user) {
  if ($('login-name')) $('login-name').value = state.user;
  if ($('login-email')) $('login-email').value = state.email || '';
  if ($('country')) $('country').value = state.country || 'Brasil';
}

updateWallet();

/* MENU PRINCIPAL */

const panelText = {
  play: [
    'Hangar orbital',
    'Sua jornada começa no Setor Orion. Decole, explore asteroides e converse com a tripulação.'
  ],
  story: [
    'Modo história',
    'A campanha narrativa está em construção. Explore o universo e descubra novos setores.'
  ],
  character: [
    'Personagem',
    'Escolha a apresentação do seu piloto.'
  ],
  ships: [
    'Naves',
    'Conheça sua nave e seus equipamentos.'
  ],
  shop: [
    'Loja do jogo',
    'Compre equipamentos usando seus créditos de teste.'
  ],
  settings: [
    'Configurações',
    'Ajuste a qualidade gráfica e a sensibilidade.'
  ]
};

function renderPanel(key) {
  const content = $('panel-content');
  if (!content) return;

  const [title, description] = panelText[key] || panelText.play;

  content.innerHTML = `
    <h1>${title}</h1>
    <p>${description}</p>
  `;

  const add = html => content.insertAdjacentHTML('beforeend', html);

  if (key === 'play') {
    add(`
      <div class="panel-actions">
        <button class="primary" id="launch">🚀 DECOLAR</button>
        <button id="brief">Falar com a oficial</button>
      </div>
      <div class="option-card">
        <b>Objetivo inicial</b>
        <small>Explore os asteroides, extraia minério e venda sua carga na estação.</small>
      </div>
    `);
  }

  if (key === 'story') {
    add(`
      <div class="option-card">
        <b>Prólogo: Sinais no vazio</b>
        <small>Uma transmissão desconhecida foi detectada no Setor Orion.</small>
      </div>
    `);
  }

  if (key === 'character') {
    add(`
      <div class="option-card">
        <b>Personagem atual: ${state.character}</b>
        <div class="panel-actions">
          <button data-char="Explorador">Masculino</button>
          <button data-char="Exploradora">Feminino</button>
        </div>
      </div>
      <button id="rename">Alterar nome do piloto</button>
    `);
  }

  if (key === 'ships') {
    add(`
      <div class="option-card">
        <b>Aurora-7</b>
        <small>Nave exploradora: equilíbrio entre velocidade e capacidade de carga.</small>
      </div>
      <div class="option-card">
        <b>Equipamento de mineração</b>
        <small>Atual: ${state.miningDrill}</small>
        <button id="buy-drill">Broca reforçada · 350 CR</button>
      </div>
    `);
  }

  if (key === 'shop') {
    add(`
      <div class="option-card">
        <b>Broca reforçada</b>
        <small>Melhora a extração de minério.</small>
        <button id="shop-drill">Comprar · 350 CR</button>
      </div>
      <div class="option-card">
        <b>Combustível</b>
        <small>Recupera até 30 unidades.</small>
        <button id="buy-fuel">Comprar · 120 CR</button>
      </div>
    `);
  }

  if (key === 'settings') {
    add(`
      <div class="field-row">
        <label for="quality">Qualidade gráfica</label>
        <select id="quality">
          <option ${state.settings.quality === 'Baixa' ? 'selected' : ''}>Baixa</option>
          <option ${state.settings.quality === 'Média' ? 'selected' : ''}>Média</option>
          <option ${state.settings.quality === 'Alta' ? 'selected' : ''}>Alta</option>
        </select>
      </div>
      <div class="field-row">
        <label for="sens">Sensibilidade</label>
        <input id="sens" type="range" min=".5" max="2" step=".1"
          value="${state.settings.sensitivity}">
      </div>
      <small>As alterações são salvas neste dispositivo.</small>
    `);
  }

  $('launch')?.addEventListener('click', startGame);

  $('brief')?.addEventListener('click', () => {
    alert('Oficial: Piloto, o campo de asteroides está liberado. Boa exploração.');
  });

  content.querySelectorAll('[data-char]').forEach(button => {
    button.addEventListener('click', () => {
      state.character = button.dataset.char;
      save();
      renderPanel('character');
    });
  });

  $('rename')?.addEventListener('click', () => {
    const name = prompt('Novo nome do piloto:', state.user);

    if (name?.trim()) {
      state.user = name.trim().slice(0, 18);
      save();
      updateWallet();
      renderPanel('character');
    }
  });

  const buyDrill = () => {
    if (state.miningDrill === 'Broca reforçada') {
      toast('Você já possui essa broca.');
      return;
    }

    if (state.credits < 350) {
      toast('Créditos insuficientes.');
      return;
    }

    state.credits -= 350;
    state.miningDrill = 'Broca reforçada';

    save();
    updateWallet();
    renderPanel(key);
    toast('Broca reforçada instalada.');
  };

  $('buy-drill')?.addEventListener('click', buyDrill);
  $('shop-drill')?.addEventListener('click', buyDrill);

  $('buy-fuel')?.addEventListener('click', () => {
    if (state.credits < 120) {
      toast('Créditos insuficientes.');
      return;
    }

    if (state.fuel >= 100) {
      toast('O tanque já está cheio.');
      return;
    }

    state.credits -= 120;
    state.fuel = Math.min(100, state.fuel + 30);

    save();
    updateWallet();
    renderPanel(key);
    toast('Combustível adicionado.');
  });

  $('quality')?.addEventListener('change', event => {
    state.settings.quality = event.target.value;
    save();
  });

  $('sens')?.addEventListener('input', event => {
    state.settings.sensitivity = Number(event.target.value);
    save();
  });
}

document.querySelectorAll('[data-panel]').forEach(button => {
  button.addEventListener('click', () => {
    renderPanel(button.dataset.panel);
  });
});

renderPanel('play');

/* MOTOR 3D */

let scene;
let camera;
let renderer;
let ship;
let stars;
let earthSystem;
let stationSystem;

let asteroids = [];
let engineFlames = [];
let engineLights = [];

let last = performance.now();
let active = false;
let npcReady = false;

const cameraNames = [
  'CÂMERA: 1ª PESSOA',
  'CÂMERA: CABINE',
  'CÂMERA: 3ª PESSOA'
];

const viewEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const cameraViewQuaternion = new THREE.Quaternion();
const forwardVector = new THREE.Vector3();

function startGame() {
  show('game-screen');

  if (!renderer) {
    init3D();
  }

  active = true;
  last = performance.now();

  updateWallet();
  toast('Setor Orion: aproxime-se dos asteroides para minerar.');
}

function addShipBox(parent, geometry, material, position, rotation = { x: 0, y: 0, z: 0 }) {
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(position.x, position.y, position.z);
  mesh.rotation.set(rotation.x, rotation.y, rotation.z);

  parent.add(mesh);
  return mesh;
}

function init3D() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020817);
  scene.fog = new THREE.FogExp2(0x020817, 0.0011);

  // Terra em posição distante, visível à frente da nave.
  earthSystem = createEarth({ radius: 48, position: [0, 0, -240] });
  scene.add(earthSystem.group);

  camera = new THREE.PerspectiveCamera(
    70,
    innerWidth / innerHeight,
    0.1,
    2500
  );

  renderer = new THREE.WebGLRenderer({
    antialias: state.settings.quality !== 'Baixa',
    powerPreference: 'high-performance'
  });

  renderer.setPixelRatio(
    Math.min(
      devicePixelRatio,
      state.settings.quality === 'Alta' ? 1.7 : 1.25
    )
  );

  renderer.setSize(innerWidth, innerHeight);
  $('game-root').appendChild(renderer.domElement);

  /* ILUMINAÇÃO AMBIENTE E SOL */

  const ambientLight = new THREE.HemisphereLight(
    0x9acfff,
    0x111827,
    0.75
  );
  scene.add(ambientLight);

  const sunPosition = new THREE.Vector3(-120, 65, -220);

  const sunLight = new THREE.PointLight(
    0xffd6a0,
    260,
    1800,
    1.15
  );

  sunLight.position.copy(sunPosition);
  scene.add(sunLight);

  const sunlight = new THREE.DirectionalLight(0xffe0b5, 2.0);
  sunlight.position.copy(sunPosition);
  scene.add(sunlight);

  const fillLight = new THREE.DirectionalLight(0x5caaff, 0.35);
  fillLight.position.set(100, 20, 80);
  scene.add(fillLight);

  /* SOL VISÍVEL */

  const sun = new THREE.Group();
  sun.position.copy(sunPosition);
  scene.add(sun);

  const sunCore = new THREE.Mesh(
    new THREE.SphereGeometry(22, 48, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffc45c
    })
  );
  sun.add(sunCore);

  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(29, 40, 28),
    new THREE.MeshBasicMaterial({
      color: 0xff9e35,
      transparent: true,
      opacity: 0.20,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  sun.add(sunGlow);

  const sunHalo = new THREE.Mesh(
    new THREE.SphereGeometry(37, 40, 28),
    new THREE.MeshBasicMaterial({
      color: 0xff6b28,
      transparent: true,
      opacity: 0.07,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  sun.add(sunHalo);

  /* ESTRELAS */

  const positions = [];

  for (let i = 0; i < 2200; i++) {
    positions.push(
      (Math.random() - 0.5) * 1200,
      (Math.random() - 0.5) * 800,
      (Math.random() - 0.5) * 1200
    );
  }

  const starGeometry = new THREE.BufferGeometry();

  starGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );

  stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.5
    })
  );

  scene.add(stars);

  /* AURORA-7 */

  ship = new THREE.Group();
  scene.add(ship);

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xaec5d8,
    metalness: 0.78,
    roughness: 0.27
  });

  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x263e55,
    metalness: 0.8,
    roughness: 0.3
  });

  const blueMat = new THREE.MeshStandardMaterial({
    color: 0x357cae,
    metalness: 0.65,
    roughness: 0.25
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x43baff,
    metalness: 0.5,
    roughness: 0.12,
    emissive: 0x07518b,
    emissiveIntensity: 0.65
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xc18b42,
    metalness: 0.75,
    roughness: 0.3
  });

  const engineMat = new THREE.MeshBasicMaterial({
    color: 0x29cfff
  });

  /* CASCO */

  const core = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.9, 3.5, 6, 12),
    hullMat
  );

  core.rotation.x = Math.PI / 2;
  ship.add(core);

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 2.5, 10),
    blueMat
  );

  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3;
  ship.add(nose);

  addShipBox(
    ship,
    new THREE.BoxGeometry(0.9, 0.16, 0.75),
    glassMat,
    { x: 0, y: 0.65, z: -1.65 }
  );

  const cockpit = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 20, 12),
    glassMat
  );

  cockpit.scale.set(1.05, 0.48, 1.3);
  cockpit.position.set(0, 0.78, -0.85);
  ship.add(cockpit);

  addShipBox(
    ship,
    new THREE.BoxGeometry(1.2, 0.2, 2.1),
    darkMat,
    { x: 0, y: 1.02, z: 0.65 }
  );

  addShipBox(
    ship,
    new THREE.BoxGeometry(1.1, 0.3, 2.3),
    blueMat,
    { x: 0, y: -0.72, z: 0.7 }
  );

  /* ASAS E NACELLES */

  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.18, 2.3),
      hullMat
    );

    wing.position.set(side * 1.75, -0.08, 0.05);
    wing.rotation.y = side * 0.12;
    ship.add(wing);

    const wingTip = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.24, 1.6),
      blueMat
    );

    wingTip.position.set(side * 2.85, -0.02, 0.15);
    ship.add(wingTip);

    const pylon = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.45, 1.5),
      darkMat
    );

    pylon.position.set(side * 1.45, 0.05, 0.55);
    ship.add(pylon);

    const nacelle = new THREE.Group();
    nacelle.position.set(side * 2.45, 0.12, 0.75);
    ship.add(nacelle);

    const nacBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.43, 3.4, 16),
      darkMat
    );

    nacBody.rotation.x = Math.PI / 2;
    nacelle.add(nacBody);

    const nacTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.18, 16),
      goldMat
    );

    nacTop.rotation.x = Math.PI / 2;
    nacTop.position.z = -1.55;
    nacelle.add(nacTop);

    const engineRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.09, 8, 20),
      blueMat
    );

    engineRing.position.z = 1.72;
    nacelle.add(engineRing);

    const engineCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 16, 12),
      engineMat
    );

    engineCore.position.z = 1.77;
    engineCore.scale.z = 0.55;
    nacelle.add(engineCore);

    const flameMaterial = new THREE.MeshBasicMaterial({
      color: 0x29cfff,
      transparent: true,
      opacity: 0.4
    });

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 1.5, 12),
      flameMaterial
    );

    flame.rotation.x = Math.PI / 2;
    flame.position.z = 2.45;
    nacelle.add(flame);
    engineFlames.push(flame);

    const engineLight = new THREE.PointLight(0x21bfff, 1.5, 15);
    engineLight.position.set(0, 0, 2.1);
    nacelle.add(engineLight);
    engineLights.push(engineLight);
  }

  /* DETALHES */

  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const windowMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.13, 0.09, 0.3),
        glassMat
      );

      windowMesh.position.set(side * 0.62, 0.63, -0.3 + i * 0.55);
      ship.add(windowMesh);
    }

    const sidePanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.4, 1.4),
      blueMat
    );

    sidePanel.position.set(side * 0.92, -0.05, 0.8);
    ship.add(sidePanel);
  }

  /* CARGA */

  const cargoBay = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 0.55, 1.45),
    darkMat
  );

  cargoBay.position.set(0, -0.55, 1.5);
  ship.add(cargoBay);

  const hangarDoor = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.08, 0.9),
    goldMat
  );

  hangarDoor.position.set(0, -0.86, 1.5);
  ship.add(hangarDoor);

  /* LUZES DE POSIÇÃO */

  for (const side of [-1, 1]) {
    const navLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 10, 8),
      new THREE.MeshBasicMaterial({
        color: side === -1 ? 0xff4545 : 0x35ff9a
      })
    );

    navLight.position.set(side * 2.8, 0.2, -0.6);
    ship.add(navLight);
  }

  /* ESCUDO */

  const shieldMesh = new THREE.Mesh(
    new THREE.SphereGeometry(4.5, 32, 20),
    new THREE.MeshBasicMaterial({
      color: 0x168bff,
      wireframe: true,
      transparent: true,
      opacity: 0.055
    })
  );

  shieldMesh.scale.set(1.05, 0.62, 1.45);
  ship.add(shieldMesh);

  /* ASTEROIDES */

  asteroids = [];

  for (let i = 0; i < 32; i++) {
    const radius = 1.1 + Math.random() * 2.2;

    const asteroid = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius, 1),
      new THREE.MeshStandardMaterial({
        color: [0x665d56, 0x77716a, 0x4e5962][i % 3],
        roughness: 1,
        flatShading: true
      })
    );

    asteroid.position.set(
      (Math.random() - 0.5) * 180,
      (Math.random() - 0.5) * 90,
      -25 - Math.random() * 260
    );

    asteroid.rotation.set(
      Math.random() * 3,
      Math.random() * 3,
      0
    );

    asteroid.userData = {
      ore: Math.floor(4 + Math.random() * 12),
      radius
    };

    scene.add(asteroid);
    asteroids.push(asteroid);
  }

  /* ESTAÇÃO ORBITAL */

  stationSystem = createStation({ position: [24, 3, -65] });
  scene.add(stationSystem.group);

  const npc = new THREE.Mesh(
    new THREE.SphereGeometry(1.3, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffc05b,
      emissive: 0x553000
    })
  );

  npc.position.set(24, 3, -77);
  scene.add(npc);

  window.addEventListener('resize', resize3D);

  requestAnimationFrame(loop);
}

/* REDIMENSIONAMENTO */

function resize3D() {
  if (!camera || !renderer) return;

  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

/* MOVIMENTO */

function updateFlight(dt) {
  if (!ship) return;

  const sensitivity = Number(state.settings.sensitivity) || 1;

  ship.rotation.y -= state.move.x * 1.25 * dt * sensitivity;
  ship.rotation.x -= state.move.y * 1.0 * dt * sensitivity;

  const targetRoll = -state.move.x * 0.25;

  ship.rotation.z = THREE.MathUtils.lerp(
    ship.rotation.z,
    targetRoll,
    Math.min(1, dt * 3)
  );

  /* ACELERAÇÃO */

  if (state.throttle && state.fuel > 0) {
    state.speed = Math.min(75, state.speed + 18 * dt);
    state.fuel = Math.max(0, state.fuel - 0.28 * dt);
  }

  /* NITRO */

  const boosting =
    state.nitroButton &&
    state.nitro > 0 &&
    state.fuel > 0;

  if (boosting) {
    state.speed = Math.min(115, state.speed + 55 * dt);
    state.nitro = Math.max(0, state.nitro - 28 * dt);
    state.fuel = Math.max(0, state.fuel - 0.55 * dt);
  } else {
    state.nitro = Math.min(100, state.nitro + 12 * dt);
  }

  /* FREIO */

  if (state.braking) {
    state.speed = Math.max(0, state.speed - 30 * dt);
  }

  if (!state.throttle && !boosting) {
    state.speed = Math.max(0, state.speed - 1.4 * dt);
  }

  /* DESLOCAMENTO */

  forwardVector
    .set(0, 0, -1)
    .applyQuaternion(ship.quaternion)
    .normalize();

  ship.position.addScaledVector(forwardVector, state.speed * dt * 0.45);

  /* EFEITOS DAS NACELLES */

  const enginePower = boosting ? 2.5 : (state.throttle ? 1.25 : 0.65);

  engineFlames.forEach(flame => {
    flame.scale.set(
      boosting ? 1.45 : 1,
      boosting ? 2.5 : enginePower,
      boosting ? 1.45 : 1
    );

    flame.material.opacity = boosting
      ? 0.95
      : (state.throttle ? 0.7 : 0.3);
  });

  engineLights.forEach(light => {
    light.intensity = boosting
      ? 8
      : (state.throttle ? 4 : 1.5);
  });

  /* HUD NITRO */

  const nitroPercent = Math.round(state.nitro);

  if ($('nitro-level')) {
    $('nitro-level').textContent = nitroPercent + '%';
  }

  if ($('nitro-fill')) {
    $('nitro-fill').style.width = nitroPercent + '%';

    $('nitro-fill').style.background = nitroPercent < 20
      ? 'linear-gradient(90deg,#b52c2c,#ff7777)'
      : 'linear-gradient(90deg,#0878d9,#37dfff)';
  }

  $('nitro-btn')?.classList.toggle('active', boosting);
}

/* CÂMERA */

function updateCamera() {
  if (!camera || !ship) return;

  viewEuler.set(
    state.view.x,
    state.view.y,
    0,
    'YXZ'
  );

  cameraViewQuaternion.setFromEuler(viewEuler);

  const finalQuaternion = ship.quaternion.clone()
    .multiply(cameraViewQuaternion);

  if (state.camera === 0) {
    const offset = new THREE.Vector3(0, 0.45, -0.65)
      .applyQuaternion(ship.quaternion);

    camera.position.copy(ship.position).add(offset);
    camera.quaternion.copy(finalQuaternion);
  } else if (state.camera === 1) {
    const offset = new THREE.Vector3(0, 0.45, 0.25)
      .applyQuaternion(ship.quaternion);

    camera.position.copy(ship.position).add(offset);
    camera.quaternion.copy(finalQuaternion);
  } else {
    const offset = new THREE.Vector3(0, 4.5, 13)
      .applyQuaternion(ship.quaternion);

    const desiredPosition = ship.position.clone().add(offset);

    camera.position.lerp(desiredPosition, 0.09);
    camera.quaternion.copy(finalQuaternion);
  }
}

/* LOOP PRINCIPAL */

function loop(now) {
  requestAnimationFrame(loop);

  if (!active || !renderer) return;

  const dt = Math.min((now - last) / 1000, 0.04);
  last = now;

  updateFlight(dt);
  updateCamera();
  earthSystem?.update(dt);

  asteroids.forEach(asteroid => {
    asteroid.rotation.x += 0.001;
    asteroid.rotation.y += 0.0015;
  });

  if (stars) stars.rotation.y += 0.00012;

  renderer.render(scene, camera);

  if ($('speed')) $('speed').textContent = Math.round(state.speed);
  if ($('fuel')) $('fuel').textContent = Math.round(state.fuel);
  if ($('cargo')) $('cargo').textContent = state.cargo + ' / 100';
  if ($('hull')) $('hull').textContent = state.hull;
  if ($('shield')) $('shield').textContent = state.shield;

  if ($('hud-credits')) {
    $('hud-credits').textContent = state.credits.toLocaleString('pt-BR');
  }
}

/* JOYSTICK */

function bindStick(id, key) {
  const element = $(id);
  if (!element) return;

  const knob = element.querySelector('.knob');
  let pointer = null;

  const moveStick = event => {
    const rect = element.getBoundingClientRect();

    let x = event.clientX - rect.left - rect.width / 2;
    let y = event.clientY - rect.top - rect.height / 2;

    const max = rect.width * 0.31;
    const length = Math.hypot(x, y);

    if (length > max) {
      x *= max / length;
      y *= max / length;
    }

    state[key].x = x / max;
    state[key].y = y / max;

    if (knob) {
      knob.style.transform = `translate(${x}px, ${y}px)`;
    }
  };

  element.addEventListener('pointerdown', event => {
    event.preventDefault();

    pointer = event.pointerId;
    element.setPointerCapture(pointer);
    moveStick(event);
  });

  element.addEventListener('pointermove', event => {
    if (pointer !== event.pointerId) return;

    event.preventDefault();
    moveStick(event);
  });

  const end = event => {
    if (pointer !== event.pointerId) return;

    pointer = null;
    state[key].x = 0;
    state[key].y = 0;

    if (knob) knob.style.transform = 'translate(0,0)';
  };

  element.addEventListener('pointerup', end);
  element.addEventListener('pointercancel', end);
  element.addEventListener('lostpointercapture', end);
}

bindStick('move-stick', 'move');

/* MIRA POR ARRASTO */

const aimArea = $('aim-touch-area');

let aimPointer = null;
let previousTouchX = 0;
let previousTouchY = 0;

if (aimArea) {
  aimArea.addEventListener('pointerdown', event => {
    event.preventDefault();

    aimPointer = event.pointerId;
    previousTouchX = event.clientX;
    previousTouchY = event.clientY;

    aimArea.setPointerCapture(aimPointer);
  });

  aimArea.addEventListener('pointermove', event => {
    if (aimPointer !== event.pointerId) return;

    event.preventDefault();

    const dx = event.clientX - previousTouchX;
    const dy = event.clientY - previousTouchY;

    previousTouchX = event.clientX;
    previousTouchY = event.clientY;

    state.view.x -= dy * 0.004;
    state.view.y -= dx * 0.004;

    state.view.x = THREE.MathUtils.clamp(state.view.x, -1.15, 1.15);
    state.view.y = THREE.MathUtils.clamp(state.view.y, -1.15, 1.15);
  });

  const endAim = event => {
    if (aimPointer === event.pointerId) {
      aimPointer = null;
    }
  };

  aimArea.addEventListener('pointerup', endAim);
  aimArea.addEventListener('pointercancel', endAim);
  aimArea.addEventListener('lostpointercapture', endAim);
}

/* BOTÕES DE PRESSÃO */

function holdButton(id, key) {
  const button = $(id);
  if (!button) return;

  button.addEventListener('pointerdown', event => {
    event.preventDefault();

    state[key] = true;

    try {
      button.setPointerCapture(event.pointerId);
    } catch (error) {
      // O botão continua funcionando mesmo sem captura.
    }
  });

  const stop = () => {
    state[key] = false;
  };

  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
    button.addEventListener(type, stop);
  });
}

holdButton('throttle-btn', 'throttle');
holdButton('brake-btn', 'braking');
holdButton('nitro-btn', 'nitroButton');

/* PROTEÇÃO CONTRA SELEÇÃO */

document.addEventListener('contextmenu', event => {
  if (event.target.closest('#flight-controls')) {
    event.preventDefault();
  }
});

document.addEventListener('selectstart', event => {
  if (event.target.closest('#flight-controls')) {
    event.preventDefault();
  }
});

/* CÂMERAS */

$('camera-btn')?.addEventListener('click', () => {
  state.camera = (state.camera + 1) % 3;

  $('camera-btn').textContent = cameraNames[state.camera];
});

/* MINERAÇÃO */

$('mine-btn')?.addEventListener('click', () => {
  if (!active) return;

  const target = asteroids.find(asteroid =>
    asteroid.position.distanceTo(ship.position) < 18
  );

  if (!target) {
    toast('Aproxime-se de um asteroide para minerar.');
    return;
  }

  if (state.cargo >= 100) {
    toast('Compartimento de carga cheio.');
    return;
  }

  const amount = Math.min(
    target.userData.ore,
    state.miningDrill === 'Broca reforçada' ? 12 : 6,
    100 - state.cargo
  );

  target.userData.ore -= amount;
  state.ore += amount;
  state.cargo += amount;

  if (target.userData.ore <= 0) {
    scene.remove(target);
    asteroids = asteroids.filter(asteroid => asteroid !== target);
  }

  save();
  updateWallet();

  toast(`Extração concluída: +${amount} unidades de minério.`);
});

/* DISPARO */

$('fire-btn')?.addEventListener('click', () => {
  toast('Canhões de pulso: sistema de combate em desenvolvimento.');
});

/* ESTAÇÃO E COMÉRCIO */

$('interact-btn')?.addEventListener('click', () => {
  if (!active) return;

  const nearStation = ship.position.distanceTo(
    new THREE.Vector3(24, 3, -65)
  ) < 22;

  if (!nearStation) {
    toast('Aproxime-se da estação para interagir.');
    return;
  }

  const bubble = $('npc-bubble');

  if (!npcReady) {
    npcReady = true;

    if (bubble) {
      bubble.innerHTML = `
        <b>Comerciante da estação</b>
        <p>Posso comprar seu minério por 8 créditos a unidade. Use INTERAGIR novamente para vender.</p>
        <button id="npc-close">FECHAR</button>
      `;

      bubble.classList.remove('hidden');
      $('npc-close')?.addEventListener('click', () => {
        bubble.classList.add('hidden');
      });
    }

    return;
  }

  if (state.cargo > 0) {
    const gain = state.cargo * 8;

    state.credits += gain;
    state.cargo = 0;

    save();
    updateWallet();

    toast(`Carga vendida: +${gain} créditos.`);

    if (bubble) {
      bubble.innerHTML = `
        <b>Comerciante</b>
        <p>Negócio fechado. Volte quando tiver mais minério.</p>
        <button id="npc-close">FECHAR</button>
      `;

      $('npc-close')?.addEventListener('click', () => {
        bubble.classList.add('hidden');
      });
    }
  } else {
    toast('Você não tem minério para vender.');
  }

  npcReady = false;
});

/* MENU DE PAUSA */

$('game-menu-btn')?.addEventListener('click', () => {
  state.throttle = false;
  state.braking = false;
  state.nitroButton = false;

  $('game-menu-modal')?.classList.remove('hidden');
});

$('resume-btn')?.addEventListener('click', () => {
  $('game-menu-modal')?.classList.add('hidden');
  last = performance.now();
});

$('return-menu-btn')?.addEventListener('click', () => {
  active = false;

  state.throttle = false;
  state.braking = false;
  state.nitroButton = false;
  state.move = { x: 0, y: 0 };
  state.view = { x: 0, y: 0 };

  $('game-menu-modal')?.classList.add('hidden');

  save();
  show('menu-screen');
  updateWallet();
});
