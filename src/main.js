import * as THREE from 'three';
import { createEarth } from './world/earth.js';
import { createStation } from './world/station.js';
import { createOrbitSystem } from './world/orbits.js';
import { createAsteroidField } from './world/asteroids.js';
import { createSpaceLighting } from './world/lighting.js';
import { createStarshipInterior } from './ships/interior.js';
import { createExplorationShip } from './ships/exploration.js';
import { state, resetTransientState } from './core/state.js';
import { createCharacterCore } from './character/characterCore.js';
import { createCharacterHUD } from './character/characterHUD.js';
import { createCharacterModel } from './character/characterModel.js';
import { createCharacterAnimator } from './character/characterAnimator.js';
import { isPilotConsoleInRange, attachCharacterToPilotConsole, returnCharacterToDeck } from './ships/bridge/commandBridge.js';
import { saveState as save, loadState as load } from './core/storage.js';
import { createShipComputer } from './ships/computer/shipComputer.js';
import { registerShipComputerSystems } from './ships/computer/shipComputerSystems.js';

const $ = id => document.getElementById(id);

const characterCore = createCharacterCore();
const shipComputer = createShipComputer();
shipComputer.registerSystem('flight', {
  name: 'Controle de voo',
  commands: {
    throttle: value => { state.throttle = Boolean(value); return state.throttle; },
    brake: value => { state.braking = Boolean(value); return state.braking; },
    nitro: value => { state.nitroButton = Boolean(value); return state.nitroButton; },
    movement: value => {
      if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return false;
      state.move.x = THREE.MathUtils.clamp(value.x, -1, 1);
      state.move.y = THREE.MathUtils.clamp(value.y, -1, 1);
      return true;
    },
    look: value => {
      if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return false;
      state.view.x = THREE.MathUtils.clamp(value.x, -1.15, 1.15);
      state.view.y = THREE.MathUtils.euclideanModulo(value.y + Math.PI, Math.PI * 2) - Math.PI;
      return true;
    }
  },
  getStatus: () => characterCore.snapshot().mode === 'ship-control' ? 'active' : 'standby'
});
shipComputer.registerTerminal({
  id: 'pilot-console',
  name: 'Console de pilotagem',
  systems: ['flight', 'navigation', 'sensors', 'power']
});
const characterHUD = createCharacterHUD(document);
let characterCameraMode = 'third-person';
let characterModel = null;
let characterAnimator = null;
let characterYaw = 0;
let characterPitch = 0;
const characterForward = new THREE.Vector3();
const characterRight = new THREE.Vector3();
const characterMove = new THREE.Vector3();
const characterLookEuler = new THREE.Euler(0, 0, 0, 'YXZ');
let characterMoveInput = { x: 0, y: 0 };
let pilotInteractionAvailable = false;
const pilotPlayerWorldPosition = new THREE.Vector3();
const characterCameraWorldPosition = new THREE.Vector3();
const characterCameraWorldQuaternion = new THREE.Quaternion();
const characterCameraForward = new THREE.Vector3();
const characterCameraOffset = new THREE.Vector3();

function updateCharacterCameraButton() {
  const button = $('character-camera-btn');
  if (!button) return;
  button.textContent = characterCameraMode === 'first-person'
    ? 'CÂMERA: 1ª PESSOA'
    : 'CÂMERA: 3ª PESSOA';
}

function updateCharacterHUD() {
  characterHUD.update({
    ...characterCore.snapshot(),
    name: state.user || state.character || 'EXPLORADOR'
  });
}

load();
state.ship = 'Nave exploradora';

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
        <b>Nave exploradora — quatro decks</b>
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
let orbitSystem;
let asteroidSystem;
let lightingSystem;
let starshipInterior;
let nearbyElevator = false;
let activeDeckIndex = 0;
let shipYaw;
let shipPitch;
let shipVisual;
const flightQuaternion = new THREE.Quaternion();
let pitchAngle = 0;

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

let launching = false;
let shipComputerSystemsRegistered = false;

function registerComputerSubsystems() {
  if (shipComputerSystemsRegistered) return;
  registerShipComputerSystems(shipComputer, {
    state,
    getShip: () => ship,
    getShipYaw: () => shipYaw?.rotation.y ?? 0,
    getPitchAngle: () => pitchAngle,
    getAsteroids: () => asteroids
  });
  shipComputerSystemsRegistered = true;
}

function loadingStep(percent, message) {
  const fill = $('loading-progress-fill');
  const value = $('loading-progress-value');
  const status = $('loading-status');

  if (fill) fill.style.width = percent + '%';
  if (value) value.textContent = percent + '%';
  if (status) status.textContent = message;

  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

async function startGame() {
  shipComputer.boot();
  if (launching) return;

  resetTransientState();
  characterCore.initialize();
  characterCore.setMode('on-foot');
  updateCharacterHUD();
  launching = true;
  active = false;
  show('game-screen');

  const loadingScreen = $('loading-screen');
  loadingScreen?.classList.remove('hidden');

  try {
    await loadingStep(6, 'Iniciando sistemas da missão...');

    if (!renderer) {
      await init3D();
    }

    registerComputerSubsystems();

    await loadingStep(100, 'Todos os sistemas prontos. Boa viagem, piloto.');
    await new Promise(resolve => setTimeout(resolve, 350));

    loadingScreen?.classList.add('hidden');
    active = true;
    last = performance.now();

    updateWallet();
    toast('Setor Orion: aproxime-se dos asteroides para minerar.');
  } catch (error) {
    console.error('Falha ao iniciar Star Frontier:', error);
    show('menu-screen');
    alert('Não foi possível carregar o jogo. Tente decolar novamente.');
  } finally {
    launching = false;
  }
}

function addShipBox(parent, geometry, material, position, rotation = { x: 0, y: 0, z: 0 }) {
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(position.x, position.y, position.z);
  mesh.rotation.set(rotation.x, rotation.y, rotation.z);

  parent.add(mesh);
  return mesh;
}

async function init3D() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020817);
  scene.fog = new THREE.FogExp2(0x020817, 0.00055);

  // Terra em posição distante, visível à frente da nave.
  earthSystem = createEarth({ radius: 78, position: [0, 0, -850] });
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

  await loadingStep(24, 'Preparando o espaço e a iluminação...');

  /* ILUMINAÇÃO E CAMPO ESTELAR */

  lightingSystem = createSpaceLighting(scene);
  stars = lightingSystem.stars;

  await loadingStep(42, 'Montando a nave exploradora de quatro decks...');

  /* NAVE PRINCIPAL — CASCO, NACELLES E ESTRUTURA DE VOO */

  const explorationShip = createExplorationShip();
  ship = explorationShip.group;
  shipYaw = explorationShip.yaw;
  shipPitch = explorationShip.pitch;
  shipVisual = explorationShip.visual;
  engineFlames = explorationShip.engineFlames;
  engineLights = explorationShip.engineLights;
  scene.add(ship);

  await loadingStep(70, 'Carregando campo de asteroides...');

  /* CAMPO DE ASTEROIDES */

  asteroidSystem = createAsteroidField(scene, { count: 24, center: [310, 0, -300], spread: [190, 100, 160] });
  asteroids = asteroidSystem.asteroids;

  await loadingStep(84, 'Carregando estação orbital e observatório...');

  /* ESTAÇÃO ORBITAL */

  stationSystem = createStation({ position: [24, 3, -65] });
  scene.add(stationSystem.group);

  await loadingStep(90, 'Integrando os quatro decks ao casco da nave...');
  starshipInterior = createStarshipInterior({ position: [0, 0, 0] });
  shipVisual.add(starshipInterior.group);
  activeDeckIndex = 0;
  nearbyElevator = false;

  // Spawn inicial no Deck 1 — ponte de comando, dentro do casco.
  characterModel = createCharacterModel({ suitColor: 0x263b50, accentColor: 0x36c9df });
  // O personagem pertence ao referencial da nave: acompanha translação e rotação
  // sem ficar para trás no espaço quando a Aurora-7 se movimenta.
  characterModel.group.position.set(0, 8.91, -18);
  characterModel.group.rotation.y = characterYaw;
  shipVisual.add(characterModel.group);
  characterAnimator = createCharacterAnimator(characterModel);
  characterAnimator.play('idle');

  const npc = new THREE.Mesh(
    new THREE.SphereGeometry(1.3, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffc05b,
      emissive: 0x553000
    })
  );

  npc.position.set(24, 3, -77);
  scene.add(npc);

  orbitSystem = createOrbitSystem({ center: [0, 0, -850], radius: 177 });
  scene.add(orbitSystem.group);

  await loadingStep(96, 'Finalizando cenário e sistemas de voo...');

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
  if (!ship || !shipYaw || !shipPitch || !shipVisual) return;

  // Protege a simulação contra saltos de tempo quando o Android pausa ou atrasa um frame.
  const safeDt = THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, 0.04);
  const sensitivity = Number(state.settings.sensitivity) || 1;

  // Guinada sempre no eixo vertical global; arfagem sempre no eixo lateral local.
  // No joystick: puxar para cima (Y negativo) sobe; puxar para baixo (Y positivo) desce.
  shipYaw.rotation.y -= state.move.x * 1.25 * safeDt * sensitivity;

  const pitchInput = state.move.y * safeDt * sensitivity;
  const maxPitch = THREE.MathUtils.degToRad(65);
  pitchAngle = THREE.MathUtils.clamp(
    pitchAngle - pitchInput,
    -maxPitch,
    maxPitch
  );
  shipPitch.rotation.x = pitchAngle;

  // A inclinação visual é isolada da orientação usada para navegar.
  const targetRoll = -state.move.x * 0.25;
  shipVisual.rotation.z = THREE.MathUtils.lerp(
    shipVisual.rotation.z,
    targetRoll,
    Math.min(1, safeDt * 3)
  );

  /* ACELERAÇÃO */

  if (state.throttle && state.fuel > 0) {
    state.speed = Math.min(75, state.speed + 18 * safeDt);
    state.fuel = Math.max(0, state.fuel - 0.28 * safeDt);
  }

  /* NITRO */

  const boosting =
    state.nitroButton &&
    state.nitro > 0 &&
    state.fuel > 0;

  if (boosting) {
    state.speed = Math.min(115, state.speed + 55 * safeDt);
    state.nitro = Math.max(0, state.nitro - 28 * safeDt);
    state.fuel = Math.max(0, state.fuel - 0.55 * safeDt);
  } else {
    state.nitro = Math.min(100, state.nitro + 12 * safeDt);
  }

  /* FREIO */

  if (state.braking) {
    state.speed = Math.max(0, state.speed - 30 * safeDt);
  }

  if (!state.throttle && !boosting) {
    state.speed = Math.max(0, state.speed - 1.4 * safeDt);
  }

  /* DESLOCAMENTO */

  shipPitch.getWorldQuaternion(flightQuaternion);
  forwardVector
    .set(0, 0, -1)
    .applyQuaternion(flightQuaternion)
    .normalize();

  ship.position.addScaledVector(forwardVector, state.speed * safeDt * 0.45);

  // Colisão da plataforma e do observatório para a nave exploradora.
  // A abertura e a escadaria continuam livres para o personagem,
  // mas são tratadas como piso sólido para a nave.
  const stationCenter = new THREE.Vector3(24, 3, -65);
  const stationScale = 1.18;
  const dx = ship.position.x - stationCenter.x;
  const dz = ship.position.z - stationCenter.z;
  const horizontalDistance = Math.hypot(dx, dz);
  let relativeHeight = ship.position.y - stationCenter.y;

  // O vão da escadaria não permite a passagem da nave.
  // Ao cruzar o nível do piso superior, a nave é mantida acima da plataforma.
  const landingDeckTop = 2.13 * stationScale;
  const shipClearance = 1.2;
  const landingDeckRadius = 11.65 * stationScale - 0.4;
  if (
    horizontalDistance < landingDeckRadius &&
    relativeHeight >= landingDeckTop - shipClearance &&
    relativeHeight < landingDeckTop + shipClearance
  ) {
    ship.position.y = stationCenter.y + landingDeckTop + shipClearance;
    relativeHeight = ship.position.y - stationCenter.y;
    state.speed = Math.min(state.speed, 8);
  }

  // Parede invisível ao redor do observatório inferior.
  // Não há exceção no corredor da escada: a nave não entra no ambiente de bípedes.
  const lowerDeckRadius = 8.65 * stationScale + 2.4;
  if (
    horizontalDistance < lowerDeckRadius &&
    relativeHeight > -4.2 &&
    relativeHeight < landingDeckTop - shipClearance
  ) {
    const safeDistance = Math.max(horizontalDistance, 0.001);
    const nx = horizontalDistance > 0.001 ? dx / safeDistance : 1;
    const nz = horizontalDistance > 0.001 ? dz / safeDistance : 0;
    ship.position.x = stationCenter.x + nx * lowerDeckRadius;
    ship.position.z = stationCenter.z + nz * lowerDeckRadius;
    state.speed = Math.min(state.speed, 8);
  }

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

/* CÂMERA DO PERSONAGEM — sempre dentro da nave */

function updateCharacterCamera() {
  if (!camera || !characterModel) return;
  const player = characterModel.group;
  player.getWorldPosition(characterCameraWorldPosition);
  player.getWorldQuaternion(characterCameraWorldQuaternion);
  characterCameraForward.set(0, 0, -1).applyQuaternion(characterCameraWorldQuaternion).normalize();

  const target = characterCameraWorldPosition.clone().add(new THREE.Vector3(0, 1.25, 0));

  if (characterCameraMode === 'first-person') {
    characterCameraOffset.set(0, 1.62, 0).applyQuaternion(characterCameraWorldQuaternion);
    camera.position.copy(characterCameraWorldPosition).add(characterCameraOffset);
    characterLookEuler.set(characterPitch, 0, 0, 'YXZ');
    camera.quaternion.copy(characterCameraWorldQuaternion).multiply(
      new THREE.Quaternion().setFromEuler(characterLookEuler)
    );
  } else {
    // Ombro/costas calculado no referencial mundial, acompanhando a nave.
    characterCameraOffset.set(0, 2.35, 5.2).applyQuaternion(characterCameraWorldQuaternion);
    const desired = characterCameraWorldPosition.clone().add(characterCameraOffset);
    camera.position.lerp(desired, 0.22);
    const lookTarget = target.addScaledVector(characterCameraForward, 1.4);
    // O arrasto vertical da mira também inclina o ponto observado em terceira pessoa.
    lookTarget.y += Math.sin(characterPitch) * 4.2;
    camera.lookAt(lookTarget);
  }
}

function isCharacterPositionBlocked(position, deckIndex) {
  const deck = starshipInterior?.layout?.decks?.[deckIndex];
  if (!deck) return true;

  // A ponte D1 é uma área de circulação aberta. Seu perímetro já é
  // controlado pelo limite elíptico do convés; as caixas das anteparas
  // antigas estavam gerando bloqueios falsos no caminho até o console.
  if (deck.id === 'D1') return false;

  const playerRadius = 0.48;
  const feetY = deck.y + 0.21;
  for (const wall of starshipInterior.collisionBoxes || []) {
    if (feetY + 1.8 < wall.y - wall.halfY || feetY > wall.y + wall.halfY) continue;

    const nearestX = THREE.MathUtils.clamp(position.x, wall.x - wall.halfX, wall.x + wall.halfX);
    const nearestZ = THREE.MathUtils.clamp(position.z, wall.z - wall.halfZ, wall.z + wall.halfZ);
    const dx = position.x - nearestX;
    const dz = position.z - nearestZ;

    // Apenas informa o bloqueio. Nunca empurra o personagem para fora da parede:
    // isso evita deslocamentos bruscos quando o ponto inicial já está sobreposto.
    if (Math.abs(dx) < playerRadius && Math.abs(dz) < playerRadius) return true;
  }
  return false;
}

function updateCharacterMovement(dt) {
  if (!characterModel || characterCore.snapshot().mode !== 'on-foot') return;
  const input = characterMoveInput;
  const magnitude = Math.min(1, Math.hypot(input.x, input.y));
  const deck = characterModel.group.position;

  if (magnitude > 0.08) {
    // A mira controla a orientação. O joystick apenas desloca o personagem,
    // sem girá-lo junto com o eixo horizontal.
    const forward = new THREE.Vector3(Math.sin(characterYaw), 0, -Math.cos(characterYaw));
    const right = new THREE.Vector3(Math.cos(characterYaw), 0, Math.sin(characterYaw));
    const direction = forward.multiplyScalar(-input.y).add(right.multiplyScalar(input.x));
    if (direction.lengthSq() > 0) direction.normalize();

    const step = 3.1 * magnitude * dt;
    const previousX = deck.x;
    const previousZ = deck.z;

    // Testa cada eixo separadamente: bloqueia somente o avanço contra a parede
    // e mantém o movimento tangencial, sem correções que causem "empurrões".
    deck.x = previousX + direction.x * step;

    if (isCharacterPositionBlocked(deck, activeDeckIndex)) deck.x = previousX;

    deck.z = previousZ + direction.z * step;

    if (isCharacterPositionBlocked(deck, activeDeckIndex)) deck.z = previousZ;

    deck.y = starshipInterior.layout.decks[activeDeckIndex].y + 0.21;
    characterModel.group.rotation.y = characterYaw;
    characterAnimator?.play(magnitude > 0.72 ? 'run' : 'walk');
  } else {
    characterAnimator?.play('idle');
  }
  characterAnimator?.update(dt);
}

function updateElevatorButtons() {
  const up = $('elevator-up-btn');
  const down = $('elevator-down-btn');
  const action = $('character-action-btn');
  if (!up || !down || !action) return;

  up.classList.toggle('hidden', !nearbyElevator || activeDeckIndex === 0);
  down.classList.toggle('hidden', !nearbyElevator || activeDeckIndex === 3);
  up.disabled = !nearbyElevator || activeDeckIndex === 0;
  down.disabled = !nearbyElevator || activeDeckIndex === 3;
  action.classList.toggle('hidden', nearbyElevator);
}

function updateElevatorInteraction() {
  if (!characterModel || characterCore.snapshot().mode !== 'on-foot') return;
  const p = characterModel.group.position;
  const inLift = Math.abs(p.x) <= 2.9 && p.z >= 22.1 && p.z <= 27.9;
  const changed = inLift !== nearbyElevator;
  nearbyElevator = inLift;
  if (changed) {
    if (inLift) {
      characterCore.setInteractionTarget('ELEVADOR INTERNO');
      updateCharacterHUD();
    } else {
      pilotInteractionAvailable = false;
      characterCore.setInteractionTarget(null);
      updateCharacterHUD();
      updatePilotInteraction();
    }
    updateElevatorButtons();
  }
}

function moveElevator(direction) {
  if (!nearbyElevator || !characterModel || characterCore.snapshot().mode !== 'on-foot') return false;
  const nextIndex = activeDeckIndex + direction;
  if (nextIndex < 0 || nextIndex > 3) return false;

  activeDeckIndex = nextIndex;
  const deck = starshipInterior.layout.decks[activeDeckIndex];
  characterModel.group.position.set(0, deck.y + 0.21, 25);
  resolveCharacterShipCollisions(characterModel.group.position, activeDeckIndex);
  nearbyElevator = true;
  characterCore.setInteractionTarget('ELEVADOR INTERNO');
  updateElevatorButtons();
  updateCharacterHUD();
  toast('Acesso ao ' + deck.name + ' liberado.');
  return true;
}

function updatePilotInteraction() {
  if (!characterModel || !shipVisual || characterCore.snapshot().mode !== 'on-foot') return;

  characterModel.group.getWorldPosition(pilotPlayerWorldPosition);
  const available = isPilotConsoleInRange(pilotPlayerWorldPosition, shipVisual);
  if (nearbyElevator) return;
  if (available === pilotInteractionAvailable) return;

  pilotInteractionAvailable = available;
  const button = $('character-action-btn');
  if (button) {
    button.disabled = !available;
    button.textContent = available ? '◎ PILOTAR' : 'AÇÃO';
    button.classList.toggle('available', available);
  }

  characterCore.setInteractionTarget(available ? 'PILOTAGEM DISPONÍVEL' : null);
  updateCharacterHUD();
}

function setPilotInterface(activePilot) {
  characterHUD.show(!activePilot);
  ['hud', 'nitro-display', 'flight-controls'].forEach(id => {
    $(id)?.classList.toggle('hidden', !activePilot);
  });
}

function enterPilotMode() {
  if (!pilotInteractionAvailable || characterCore.snapshot().mode !== 'on-foot') {
    toast('Aproxime-se do ponto de pilotagem na ponte.');
    return;
  }

  if (!shipComputer.connectTerminal('pilot-console', state.user || 'PILOTO')) {
    toast('Computador da nave indisponível ou console ocupado.');
    return;
  }
  if (!attachCharacterToPilotConsole(characterModel, shipVisual)) {
    shipComputer.disconnectTerminal('pilot-console');
    return;
  }

  characterMoveInput = { x: 0, y: 0 };
  characterCore.enterShipSeat();
  pilotInteractionAvailable = false;
  state.camera = 0;
  state.view.x = 0;
  state.view.y = 0;
  setPilotInterface(true);
  toast('Comando da Aurora-7 assumido.');
}

function exitPilotMode() {
  if (characterCore.snapshot().mode !== 'ship-control') return;

  shipComputer.disconnectTerminal('pilot-console');
  characterYaw = returnCharacterToDeck(characterModel, shipVisual, scene);
  characterPitch = 0;
  characterCore.leaveShipSeat();

  characterMoveInput = { x: 0, y: 0 };
  state.move.x = 0;
  state.move.y = 0;
  state.throttle = false;
  state.braking = false;
  state.nitroButton = false;

  const flightStick = $('move-stick')?.querySelector('.knob');
  if (flightStick) flightStick.style.transform = 'translate(0,0)';

  setPilotInterface(false);
  updateCharacterHUD();
  updatePilotInteraction();
  toast('Você deixou o comando da nave.');
}

/* CÂMERA */

function updateCamera() {
  if (!camera || !ship || !shipVisual) return;

  viewEuler.set(
    state.view.x,
    state.view.y,
    0,
    'YXZ'
  );

  cameraViewQuaternion.setFromEuler(viewEuler);
  shipVisual.getWorldQuaternion(flightQuaternion);
  const finalQuaternion = flightQuaternion.clone().multiply(cameraViewQuaternion);

  if (state.camera === 0) {
    // Ponto de visão dentro da ponte, no deck superior.
    const offset = new THREE.Vector3(0, 11.1, -30)
      .applyQuaternion(flightQuaternion);

    camera.position.copy(ship.position).add(offset);
    camera.quaternion.copy(finalQuaternion);
  } else if (state.camera === 1) {
    const offset = new THREE.Vector3(0, 10.8, -20)
      .applyQuaternion(flightQuaternion);

    camera.position.copy(ship.position).add(offset);
    camera.quaternion.copy(finalQuaternion);
  } else {
    // Câmera externa mais próxima, orbitando a nave com o arrasto da mira.
    const offset = new THREE.Vector3(0, 28, 112)
      .applyQuaternion(flightQuaternion)
      .applyQuaternion(cameraViewQuaternion);

    const desiredPosition = ship.position.clone().add(offset);
    camera.position.lerp(desiredPosition, 0.12);
    camera.lookAt(ship.position);
  }
}

/* LOOP PRINCIPAL */

function loop(now) {
  requestAnimationFrame(loop);

  if (!active || !renderer) return;

  const dt = Math.min((now - last) / 1000, 0.04);
  last = now;

  if (characterCore.snapshot().mode === 'on-foot') {
    updateCharacterMovement(dt);
    updateElevatorInteraction();
    updatePilotInteraction();
    updateCharacterCamera();
  } else {
    updateFlight(dt);
    updateCamera();
  }
  earthSystem?.update(dt);
  orbitSystem?.update(dt);
  asteroidSystem?.update(dt);
  lightingSystem?.update(dt);

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

    const nextX = x / max;
    const nextY = y / max;
    if (key === 'move' && shipComputer.isTerminalConnected('pilot-console')) {
      shipComputer.dispatch('pilot-console', 'flight', 'movement', { x: nextX, y: nextY });
    } else {
      state[key].x = nextX;
      state[key].y = nextY;
    }

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
    if (key === 'move' && shipComputer.isTerminalConnected('pilot-console')) {
      shipComputer.dispatch('pilot-console', 'flight', 'movement', { x: 0, y: 0 });
    } else {
      state[key].x = 0;
      state[key].y = 0;
    }

    if (knob) knob.style.transform = 'translate(0,0)';
  };

  element.addEventListener('pointerup', end);
  element.addEventListener('pointercancel', end);
  element.addEventListener('lostpointercapture', end);
}

bindStick('move-stick', 'move');

// Joystick exclusivo do personagem; não altera os comandos de voo.
const characterStick = $('character-move-stick');
if (characterStick) {
  const knob = characterStick.querySelector('.character-move-knob');
  let pointer = null;
  const moveCharacterStick = event => {
    const rect = characterStick.getBoundingClientRect();
    let x = event.clientX - rect.left - rect.width / 2;
    let y = event.clientY - rect.top - rect.height / 2;
    const max = rect.width * 0.31;
    const length = Math.hypot(x, y);
    if (length > max) { x *= max / length; y *= max / length; }
    characterMoveInput = { x: x / max, y: y / max };
    if (knob) knob.style.transform = `translate(${x}px, ${y}px)`;
  };
  characterStick.addEventListener('pointerdown', event => {
    event.preventDefault();
    pointer = event.pointerId;
    characterStick.setPointerCapture(pointer);
    moveCharacterStick(event);
  });
  characterStick.addEventListener('pointermove', event => {
    if (pointer !== event.pointerId) return;
    event.preventDefault();
    moveCharacterStick(event);
  });
  const endCharacterMove = event => {
    if (pointer !== event.pointerId) return;
    pointer = null;
    characterMoveInput = { x: 0, y: 0 };
    if (knob) knob.style.transform = 'translate(0,0)';
  };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type =>
    characterStick.addEventListener(type, endCharacterMove)
  );
}

const characterAim = $('character-aim-area');
let characterAimPointer = null;
let characterPreviousX = 0;
let characterPreviousY = 0;
if (characterAim) {
  characterAim.addEventListener('pointerdown', event => {
    event.preventDefault();
    characterAimPointer = event.pointerId;
    characterPreviousX = event.clientX;
    characterPreviousY = event.clientY;
    characterAim.setPointerCapture(characterAimPointer);
  });
  characterAim.addEventListener('pointermove', event => {
    if (characterAimPointer !== event.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - characterPreviousX;
    const dy = event.clientY - characterPreviousY;
    characterPreviousX = event.clientX;
    characterPreviousY = event.clientY;
    characterYaw -= dx * 0.005;
    characterPitch = THREE.MathUtils.clamp(characterPitch - dy * 0.004, -0.65, 0.65);
    // Atualiza a orientação imediatamente, mesmo quando o personagem está parado.
    if (characterModel?.group) characterModel.group.rotation.y = characterYaw;
  });
  const endCharacterAim = event => {
    if (characterAimPointer === event.pointerId) characterAimPointer = null;
  };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type =>
    characterAim.addEventListener(type, endCharacterAim)
  );
}

$('character-action-btn')?.addEventListener('click', enterPilotMode);
$('elevator-up-btn')?.addEventListener('click', () => moveElevator(-1));
$('elevator-down-btn')?.addEventListener('click', () => moveElevator(1));

function closeInventory() {
  const modal = $('inventory-modal');
  modal?.classList.add('hidden');
  modal?.setAttribute('aria-hidden', 'true');
}
function openInventory() {
  const modal = $('inventory-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  showInventoryTab('items');
}
function showInventoryTab(tab) {
  const items = tab === 'items';
  $('inventory-items-view')?.classList.toggle('hidden', !items);
  $('inventory-clothing-view')?.classList.toggle('hidden', items);
  document.querySelectorAll('[data-inventory-tab]').forEach(button => {
    button.classList.toggle('active', button.dataset.inventoryTab === tab);
  });
}
function renderInventory() {
  const grid = $('inventory-grid');
  if (!grid) return;
  const items = Array.isArray(state.inventory?.items) ? state.inventory.items : [];
  $('inventory-count').textContent = `${items.length} / 24`;
  grid.innerHTML = Array.from({ length: 24 }, (_, index) => {
    const item = items[index];
    return `<div class="inventory-cell"><span>${item?.name || 'ESPAÇO LIVRE'}</span></div>`;
  }).join('');
  const equipment = state.inventory?.equipment || {};
  ['weapon', 'tool', 'machine'].forEach(slot => {
    const el = $('quick-' + slot);
    if (el) el.textContent = equipment[slot] || 'VAZIO';
  });
}
$('inventory-open-btn')?.addEventListener('click', () => {
  renderInventory();
  openInventory();
});
$('inventory-close-btn')?.addEventListener('click', closeInventory);
$('inventory-done-btn')?.addEventListener('click', closeInventory);
document.querySelectorAll('[data-inventory-tab]').forEach(button => {
  button.addEventListener('click', () => showInventoryTab(button.dataset.inventoryTab));
});
$('inventory-modal')?.addEventListener('click', event => {
  if (event.target.id === 'inventory-modal') closeInventory();
});
document.querySelectorAll('[data-slot]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-slot]').forEach(slot => slot.classList.remove('selected'));
    button.classList.add('selected');
  });
});
renderInventory();
$('leave-pilot-btn')?.addEventListener('click', exitPilotMode);

if ($('character-action-btn')) $('character-action-btn').disabled = true;

// Ao perder foco no Android, zera entradas para impedir joystick ou aceleração presos.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) resetTransientState();
});

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

    const nextView = {
      x: THREE.MathUtils.clamp(state.view.x - dy * 0.004, -1.15, 1.15),
      // A rotação horizontal é contínua: permite completar voltas de 360°.
      y: THREE.MathUtils.euclideanModulo(
        state.view.y - dx * 0.004 + Math.PI,
        Math.PI * 2
      ) - Math.PI
    };
    if (shipComputer.isTerminalConnected('pilot-console')) {
      shipComputer.dispatch('pilot-console', 'flight', 'look', nextView);
    } else {
      state.view.x = nextView.x;
      state.view.y = nextView.y;
    }
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

    const flightCommand = { throttle: 'throttle', braking: 'brake', nitroButton: 'nitro' }[key];
    if (flightCommand && shipComputer.isTerminalConnected('pilot-console')) {
      shipComputer.dispatch('pilot-console', 'flight', flightCommand, true);
    } else {
      state[key] = true;
    }

    try {
      button.setPointerCapture(event.pointerId);
    } catch (error) {
      // O botão continua funcionando mesmo sem captura.
    }
  });

  const stop = () => {
    const flightCommand = { throttle: 'throttle', braking: 'brake', nitroButton: 'nitro' }[key];
    if (flightCommand && shipComputer.isTerminalConnected('pilot-console')) {
      shipComputer.dispatch('pilot-console', 'flight', flightCommand, false);
    } else {
      state[key] = false;
    }
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
    asteroidSystem?.remove(target);
    asteroids = asteroidSystem?.asteroids || [];
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

$('character-camera-btn')?.addEventListener('click', () => {
  characterCameraMode = characterCameraMode === 'first-person'
    ? 'third-person'
    : 'first-person';
  updateCharacterCameraButton();
  if (camera && characterModel) updateCharacterCamera();
});
updateCharacterCameraButton();

$('character-menu-btn')?.addEventListener('click', () => {
  $('game-menu-modal')?.classList.remove('hidden');
});

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
