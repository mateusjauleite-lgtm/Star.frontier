import * as THREE from 'three';
import { registerAimControls, registerHeldFlightControls, registerFlightSelectionGuards, registerCameraCycleControl } from './controls/gameControls.js';
import { registerGameplayActions } from './systems/gameplayActions.js';
import { loadRuntimeKernel } from './core/runtime/RuntimeKernel.js';
import { createRuntimeBridge } from './core/runtime/RuntimeBridge.js';
import { registerGameRuntimeSystems } from './core/runtime/systems/registerGameRuntimeSystems.js';
import { createGameWorld } from './world/gameWorld.js';
import { createShipLandingMetricTelemetryAdapter, SHIP_MODEL_METERS_PER_UNIT } from './ships/flight/landingAutopilot.js';
import { EXTERNAL_ELEVATOR_CONFIG } from './ships/externalElevator.js';
import { getLandingSite } from './ships/flight/landingSites.js';
import { state, resetTransientState } from './core/state.js';
import { createCharacterCore } from './character/characterCore.js';
import { createCharacterHUD } from './character/characterHUD.js';
import { createCharacterAudio } from './character/characterAudio.js';
import { createShipAudio } from './ships/shipAudio.js';
import { createCharacterEquipmentSystem } from './inventory/characterEquipment.js';
import { isPilotConsoleInRange, attachCharacterToPilotConsole, returnCharacterToDeck } from './ships/bridge/commandBridge.js';
import { saveState as save, loadState as load } from './core/storage.js';
import { createShipComputer } from './ships/computer/shipComputer.js';
import { registerShipComputerSystems } from './ships/computer/shipComputerSystems.js';
import { advanceShipFlightDynamics } from './ships/flight/flightDynamics.js';
import { registerTextInteractionGuard } from './core/ui/textInteractionGuard.js';

registerTextInteractionGuard();

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const characterCore = createCharacterCore();
const characterAudio = createCharacterAudio({ core: characterCore });
characterAudio.attach();
const shipAudio = createShipAudio();
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
let characterCameraInitialized = false;
let characterModel = null;
let characterAnimator = null;
let characterWeaponController = null;
let characterPhysics = null;
let characterYaw = 0;
let characterPitch = 0;
const characterForward = new THREE.Vector3();
const characterRight = new THREE.Vector3();
const characterMove = new THREE.Vector3();
const characterLookEuler = new THREE.Euler(0, 0, 0, 'YXZ');
let characterMoveInput = { x: 0, y: 0 };
let characterFootstepTimer = 0;
let characterSprintHeld = false;
let characterAnimationTestRemaining = 0;
let characterAnimationTestIndex = -1;
const characterAnimationTestPoses = ['walk', 'run', 'jump', 'fall', 'land', 'sit', 'stand', 'idle'];
let characterJumpQueued = false;
let characterStaminaAccumulator = 0;
let characterStaminaHudTimer = 0;
let phaserChargeRemaining = 0;
let phaserShotFlashRemaining = 0;
const PHASER_RECHARGE_SECONDS = 2.5;
const PHASER_FLASH_SECONDS = 0.16;
let pilotInteractionAvailable = false;
const pilotPlayerWorldPosition = new THREE.Vector3();
const characterCameraWorldPosition = new THREE.Vector3();
const characterCameraWorldQuaternion = new THREE.Quaternion();
const characterCameraForward = new THREE.Vector3();
const characterCameraOffset = new THREE.Vector3();

function isPhaserEquipped() {
  return Boolean(characterEquipment?.equippedItem('weapon'));
}

function updatePhaserWeapon(dt) {
  const button = $('character-phaser-btn');
  const fill = $('phaser-charge-fill');
  if (phaserChargeRemaining > 0) phaserChargeRemaining = Math.max(0, phaserChargeRemaining - dt);
  if (phaserShotFlashRemaining > 0) {
    phaserShotFlashRemaining = Math.max(0, phaserShotFlashRemaining - dt);
    const phaser = characterModel?.wardrobe?.weapon?.userData?.phaser;
    if (phaser) {
      phaser.position.z = THREE.MathUtils.lerp(-0.105, -0.145, phaserShotFlashRemaining / PHASER_FLASH_SECONDS);
      if (phaser.userData.muzzleLight) phaser.userData.muzzleLight.intensity = 4.5 * (phaserShotFlashRemaining / PHASER_FLASH_SECONDS);
      if (phaser.userData.beam) phaser.userData.beam.visible = phaserShotFlashRemaining > 0;
    }
  } else {
    const phaser = characterModel?.wardrobe?.weapon?.userData?.phaser;
    if (phaser) {
      phaser.position.z = -0.105;
      if (phaser.userData.muzzleLight) phaser.userData.muzzleLight.intensity = 0;
      if (phaser.userData.beam) phaser.userData.beam.visible = false;
    }
  }
  const equipped = isPhaserEquipped();
  if (button) {
    button.disabled = !equipped;
    button.classList.toggle('is-ready', equipped && phaserChargeRemaining <= 0);
    button.classList.toggle('is-charging', equipped && phaserChargeRemaining > 0);
    const label = button.querySelector('small');
    if (label) {
      const nextLabel = !equipped
        ? 'SEM ARMA'
        : phaserChargeRemaining > 0
          ? 'RECARGA ' + phaserChargeRemaining.toFixed(1) + 's'
          : 'PRONTO';
      if (label.textContent !== nextLabel) label.textContent = nextLabel;
    }
  }
  if (fill) fill.style.width = equipped
    ? (100 * (1 - phaserChargeRemaining / PHASER_RECHARGE_SECONDS)) + '%'
    : '0%';
}

function firePhaser() {
  if (!isPhaserEquipped()) {
    toast('Equipe o Phaser pelo inventário primeiro.');
    return;
  }
  if (phaserChargeRemaining > 0) {
    const label = $('character-phaser-btn')?.querySelector('small');
    if (label) label.textContent = 'RECARGA ' + phaserChargeRemaining.toFixed(1) + 's';
    return;
  }
  if (characterCore.snapshot().mode !== 'on-foot') {
    toast('O Phaser só pode ser usado a pé nesta versão.');
    return;
  }
  phaserChargeRemaining = PHASER_RECHARGE_SECONDS;
  phaserShotFlashRemaining = PHASER_FLASH_SECONDS;
  characterWeaponController?.fire();
  characterAudio.playPhaser();
  const phaser = characterModel?.wardrobe?.weapon?.userData?.phaser;
  if (phaser?.userData.muzzleLight) phaser.userData.muzzleLight.intensity = 4.5;
  toast('Phaser disparado · recarga energética iniciada.');
}

function updateCharacterCameraButton() {
  const button = $('character-camera-btn');
  if (!button) return;
  button.textContent = characterCameraMode === 'first-person'
    ? 'CÂMERA: 1ª PESSOA'
    : 'CÂMERA: 3ª PESSOA';
}

function updateCharacterHUD() {
  const planetaryProfile = earthSystem?.getPlanetaryProfile?.();
  characterHUD.update({
    ...characterCore.snapshot(),
    name: state.user || state.character || 'EXPLORADOR',
    environment: planetaryProfile ? {
      label: `${planetaryProfile.displayName} • R MÉDIO ${Math.round(planetaryProfile.physical.meanRadiusKm).toLocaleString('pt-BR')} KM`
    } : null
  });
}

load();
state.ship = 'Nave exploradora';

/* UTILITÁRIOS */

function show(id) {
  ['startup-screen', 'login-screen', 'menu-screen', 'game-screen'].forEach(name => {
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

$('startup-play-btn')?.addEventListener('click', () => {
  show('login-screen');
});

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
let earthReferenceFrames = null;
let lastEarthSurfaceRotationY = null;
let stationSystem;
let landingBaseSystem;
let selectedLandingSiteId = null;
let shipFlightKernel = null;
let gravityKernel = null;
let characterInWorldFrame = false;
const characterWorldVelocity = new THREE.Vector3();
let characterWorldGrounded = false;
let shipLandingAutopilot = null;
const shipLandingTelemetry = createShipLandingMetricTelemetryAdapter({
  modelMetersPerUnit: SHIP_MODEL_METERS_PER_UNIT,
  deckHeightMeters: 0.76,
  deckRadiusMeters: 146
});
let orbitSystem;
let asteroidSystem;
let lightingSystem;
let starshipInterior;
let externalElevator = null;
let externalElevatorRiding = false;
let externalElevatorActionAvailable = false;
let nearbyElevator = false;
let activeDeckIndex = 0;
let shipYaw;
let shipPitch;
let shipVisual;
let shipLandingGear;
let shipLandingGearContactPoints = [];

// Estruturas externas da popa que invadem visualmente o espaço útil do Deck 4.
// São ocultadas somente enquanto o personagem está no D4 e restauradas nos demais decks.
const deck4ClearanceNames = new Set([
  'Engineering-Secondary-Hull',
  'Integrated-Aft-Engineering-Pod',
  'Aft-Hangar-Nacelle-Junction',
  'Central-Hangar-Upper-Lip',
  'Central-Hangar-Lower-Lip'
]);

function updateDeck4Clearance() {
  if (!shipVisual) return;
  const deck4Active = activeDeckIndex === 3;
  shipVisual.traverse(object => {
    if (deck4ClearanceNames.has(object.name)) {
      object.visible = !deck4Active;
    }
  });
}

const flightQuaternion = new THREE.Quaternion();
let pitchAngle = 0;

let asteroids = [];
let engineFlames = [];
let engineLights = [];

// Pontos de referência na concha inferior do casco. Servem primeiro para
// medir folga/contato com o relevo; não aplicam forças nem alteram a trajetória.
const shipEarthContactPoints = [
  { id: 'keel', point: new THREE.Vector3(0, -15.2, 0) },
  { id: 'fore-port', point: new THREE.Vector3(-12, -11.89, -22) },
  { id: 'fore-starboard', point: new THREE.Vector3(12, -11.89, -22) },
  { id: 'aft-port', point: new THREE.Vector3(-12, -11.89, 22) },
  { id: 'aft-starboard', point: new THREE.Vector3(12, -11.89, 22) }
];

let active = false;
let runtimeBridge = null;
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



/* INICIALIZAÇÃO DO APLICATIVO: carregamento -> JOGAR -> LOGIN -> MENU */
async function bootApplication() {
  const loadingScreen = $('loading-screen');

  // Reaproveita a mesma tela visual usada ao iniciar a missão após DECOLAR.
  // Nesta etapa, o aplicativo prepara a interface e o menu; a cena 3D continua
  // sendo inicializada no fluxo de DECOLAR, como já acontece atualmente.
  show('game-screen');
  loadingScreen?.classList.remove('hidden');

  const stages = [
    [8, 'Inicializando Star.frontier...'],
    [28, 'Carregando os sistemas do jogo...'],
    [54, 'Preparando a interface do piloto...'],
    [78, 'Carregando o menu principal...'],
    [100, 'Inicialização concluída.']
  ];

  for (const [percent, message] of stages) {
    await loadingStep(percent, message);
    await new Promise(resolve => setTimeout(resolve, 180));
  }

  loadingScreen?.classList.add('hidden');
  show('startup-screen');
}

async function startGame() {
  if (launching) return;

  launching = true;
  active = false;

  const gameScreen = $('game-screen');
  const loadingScreen = $('loading-screen');
  let startupStage = 'preparação do personagem';

  // O menu é HTML/CSS; a cena e a gameplay são renderizadas pelo Three.js.
  // Mostra a tela antes de pedir fullscreen, pois elementos ocultos não
  // podem entrar em fullscreen em vários navegadores/WebViews.
  show('game-screen');
  loadingScreen?.classList.remove('hidden');

  try {
    if (!runtimeBridge) {
      const runtimeKernel = await loadRuntimeKernel({ maximumDeltaSeconds: 0.04 });
      runtimeBridge = createRuntimeBridge(runtimeKernel);
      registerGameRuntimeSystems(runtimeBridge, {
        character: {
          core: characterCore,
          resetTransientState,
          resetCounters: () => {
            characterStaminaAccumulator = 0;
            characterStaminaHudTimer = 0;
          },
          updateHUD: updateCharacterHUD,
          onStage: stage => { startupStage = stage; }
        },
        world: {
          isReady: () => Boolean(renderer),
          initializeWorld: init3D,
          onStage: stage => { startupStage = stage; }
        },
        orbitalPhysics: {
          getShipFlightKernel: () => shipFlightKernel,
          getGravityKernel: () => gravityKernel,
          getEarthOrbitalFrame: () => {
            if (!earthSystem?.group) return null;
            earthSystem.group.updateWorldMatrix(true, false);
            const profile = earthSystem.getPlanetaryProfile?.();
            if (!profile?.render?.visualUnitsPerKm) return null;
            return {
              originWorld: earthSystem.group.getWorldPosition(new THREE.Vector3()).toArray(),
              // O referencial orbital usa os eixos globais inerciais; a rotação
              // da superfície terrestre permanece no referencial terrestre.
              orientationWorld: [0, 0, 0, 1],
              visualUnitsPerKm: profile.render.visualUnitsPerKm
            };
          },
          getShipWorldPosition: () => {
            if (!ship) return null;
            ship.updateWorldMatrix(true, false);
            return ship.getWorldPosition(new THREE.Vector3()).toArray();
          },
          getShipForwardWorld: () => {
            if (!shipPitch) return null;
            const orientation = shipVisual.getWorldQuaternion(new THREE.Quaternion());
            return new THREE.Vector3(0, 0, -1).applyQuaternion(orientation).normalize().toArray();
          }
        },
        shipComputer: {
          registerSystems: () => {
            try {
              registerComputerSubsystems();
            } catch (error) {
              // Evita repetir um registro parcial de subsistemas em uma nova tentativa.
              shipComputerSystemsRegistered = true;
              throw error;
            }
          },
          boot: () => shipComputer.boot(),
          shutdown: () => shipComputer.shutdown(),
          onStage: stage => { startupStage = stage; },
          onError: (error, phase) => {
            console.error(
              phase === 'register'
                ? 'Subsistemas auxiliares do computador indisponíveis:'
                : 'Não foi possível ativar o computador auxiliar:',
              error
            );
            toast(
              phase === 'register'
                ? 'Computador auxiliar indisponível; controles básicos mantidos.'
                : 'Computador auxiliar offline; gameplay mantida.'
            );
          }
        },
        gameplay: { update: updateGameplayFrame }
      });
    }

    // O primeiro toque do jogador libera o AudioContext no Android/WebView.
    void characterAudio.unlock();
    void shipAudio.unlock();

    // O fullscreen precisa abranger o documento inteiro, não apenas a gameplay.
    // Assim, ao voltar ao menu principal, os botões continuam dentro da área
    // fullscreen e não ficam atrás de um elemento fullscreen oculto.
    const fullscreenRoot = document.documentElement;
    const requestFullscreen = fullscreenRoot?.requestFullscreen || fullscreenRoot?.webkitRequestFullscreen;
    if (requestFullscreen && !document.fullscreenElement && !document.webkitFullscreenElement) {
      try {
        const result = requestFullscreen.call(fullscreenRoot, { navigationUI: 'hide' });
        result?.catch?.(() => {});
      } catch (error) {
        console.info('Fullscreen do navegador indisponível; mantendo a janela nativa do APK.', error);
      }
    }

    try {
      window.screen?.orientation?.lock?.('landscape')?.catch?.(() => {});
    } catch {}

    await loadingStep(6, 'Iniciando sistemas da missão...');

    const runtimeInitialized = await runtimeBridge.initialize({
      state,
      getScene: () => scene,
      getCamera: () => camera,
      getRenderer: () => renderer
    });
    if (!runtimeInitialized) {
      throw new Error('O Runtime não conseguiu inicializar seus sistemas.');
    }
    if (characterInWorldFrame && characterModel?.group && shipVisual) {
      scene.remove(characterModel.group);
      shipVisual.add(characterModel.group);
      characterModel.group.position.set(0, 8.91, -18);
      characterModel.group.rotation.set(0, characterYaw, 0);
      characterInWorldFrame = false;
      characterWorldGrounded = false;
      characterWorldVelocity.set(0, 0, 0);
      characterPhysics?.reset(characterModel.group.position.y);
      characterCore.setGrounded(true);
    }

    startupStage = 'integração do personagem e HUD';
    updateCharacterHUD();

    startupStage = 'finalização da gameplay';
    await loadingStep(100, 'Todos os sistemas prontos. Boa viagem, piloto.');
    await new Promise(resolve => setTimeout(resolve, 350));

    loadingScreen?.classList.add('hidden');

    // O HUD usa medidas do DOM. Só aplicar posições salvas depois que a tela
    // do jogo estiver visível e o WebView concluir o layout em dois frames.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    applyCharacterHudLayout(readCharacterHudLayout());

    if (!runtimeBridge.start()) {
      throw new Error('O Runtime não conseguiu iniciar o ciclo de execução.');
    }
    if (!runtimeBridge.startFrameLoop()) {
      throw new Error('O Runtime não conseguiu iniciar o relógio de frames.');
    }
    active = true;

    updateWallet();
    toast('Setor Orion: aproxime-se dos asteroides para minerar.');
  } catch (error) {
    console.error(`Falha ao iniciar Star Frontier na etapa: ${startupStage}`, error);

    active = false;
    try {
      await runtimeBridge?.shutdown();
    } catch (shutdownError) {
      console.warn('Não foi possível encerrar o Runtime:', shutdownError);
    }
    loadingScreen?.classList.add('hidden');

    if (scene) {
      scene.traverse(object => {
        if (!object.isMesh && !object.isLine && !object.isPoints) return;
        object.geometry?.dispose?.();
        const materials = Array.isArray(object.material)
          ? object.material
          : object.material ? [object.material] : [];
        materials.forEach(material => material?.dispose?.());
      });
    }

    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement?.remove();
    }

    try {
      shipComputer.shutdown();
    } catch (shutdownError) {
      console.warn('Não foi possível desligar o computador auxiliar:', shutdownError);
    }

    renderer = null;
    scene = null;
    camera = null;
    ship = null;
    shipYaw = null;
    shipPitch = null;
    shipVisual = null;
    shipLandingGear = null;
    shipLandingGearContactPoints = [];
    stars = null;
    earthSystem = null;
    earthReferenceFrames = null;
    stationSystem = null;
    landingBaseSystem = null;
    selectedLandingSiteId = null;
    shipLandingAutopilot?.cancel?.();
    shipLandingAutopilot = null;
    lastEarthSurfaceRotationY = null;
    shipFlightKernel?.dispose?.();
    shipFlightKernel = null;
    shipLandingTelemetry.reset();
    orbitSystem = null;
    asteroidSystem = null;
    lightingSystem = null;
    starshipInterior = null;
    characterModel = null;
    characterAnimator = null;
    characterPhysics = null;
    asteroids = [];
    engineFlames = [];
    engineLights = [];
    nearbyElevator = false;
    activeDeckIndex = 0;
    npcReady = false;

    show('menu-screen');
    const detail = error?.message ? ` Detalhe: ${error.message}` : '';
    alert(`Não foi possível carregar a gameplay Three.js. Etapa: ${startupStage}.${detail} Você pode tentar novamente.`);
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
  const world = await createGameWorld({
    THREE,
    state,
    gameRoot: $('game-root'),
    viewport: {
      width: innerWidth,
      height: innerHeight,
      devicePixelRatio
    },
    loadingStep,
    characterCore,
    characterEquipment,
    characterYaw,
    shipLandingTelemetry
  });

  ({
    scene,
    camera,
    renderer,
    ship,
    stars,
    earthSystem,
    earthReferenceFrames,
    stationSystem,
    shipFlightKernel,
    gravityKernel,
    shipLandingAutopilot,
    shipLandingGear,
    shipLandingGearContactPoints,
    shipYaw,
    shipPitch,
    shipVisual,
    engineFlames,
    engineLights,
    asteroidSystem,
    asteroids,
    lightingSystem,
    starshipInterior,
    externalElevator,
    nearbyElevator,
    activeDeckIndex,
    characterModel,
    characterAnimator,
    characterWeaponController,
    characterPhysics
  } = world);

  characterCameraInitialized = false;
  characterInWorldFrame = false;
  characterWorldGrounded = false;
  characterWorldVelocity.set(0, 0, 0);
  externalElevatorRiding = false;
  externalElevatorActionAvailable = false;
  lastEarthSurfaceRotationY = null;
  updateDeck4Clearance();

  window.addEventListener('resize', resize3D);
}

/* REDIMENSIONAMENTO */

function resize3D() {
  if (!camera || !renderer) return;

  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  scheduleCharacterHudLayout();
}

/* MOVIMENTO */

function applyEarthSurfaceRotation(deltaSeconds) {
  const rotationState = earthSystem?.getSurfaceRotationState?.();
  if (!rotationState || !Number.isFinite(rotationState.rotationY)) {
    lastEarthSurfaceRotationY = null;
    return;
  }

  const currentRotation = rotationState.rotationY;
  if (lastEarthSurfaceRotationY === null) {
    lastEarthSurfaceRotationY = currentRotation;
    return;
  }

  const deltaRotation = THREE.MathUtils.euclideanModulo(
    currentRotation - lastEarthSurfaceRotationY + Math.PI,
    Math.PI * 2
  ) - Math.PI;
  lastEarthSurfaceRotationY = currentRotation;
  if (Math.abs(deltaRotation) < 1e-9) return;

  const earthCenter = earthSystem.group.getWorldPosition(new THREE.Vector3());
  const earthWorldQuaternion = earthSystem.group.getWorldQuaternion(new THREE.Quaternion());
  const axis = rotationState.localAxis.clone().applyQuaternion(earthWorldQuaternion).normalize();
  const rotation = new THREE.Quaternion().setFromAxisAngle(axis, deltaRotation);

  const rotateObjectInWorld = object => {
    if (!object?.parent) return;
    object.updateWorldMatrix(true, false);
    const worldPosition = object.getWorldPosition(new THREE.Vector3());
    const worldQuaternion = object.getWorldQuaternion(new THREE.Quaternion());
    worldPosition.sub(earthCenter).applyQuaternion(rotation).add(earthCenter);
    worldQuaternion.premultiply(rotation);

    object.parent.updateWorldMatrix(true, false);
    object.position.copy(object.parent.worldToLocal(worldPosition));
    const parentQuaternion = object.parent.getWorldQuaternion(new THREE.Quaternion());
    object.quaternion.copy(parentQuaternion.invert().multiply(worldQuaternion));
  };

  if (ship?.userData?.earthSurfaceAnchored) rotateObjectInWorld(ship);
}

function updateFlight(dt) {
  if (!ship || !shipYaw || !shipPitch || !shipVisual) return;

  // Protege a simulação contra saltos de tempo quando o Android pausa ou atrasa um frame.
  const safeDt = THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, 0.04);
  const sensitivity = Number(state.settings.sensitivity) || 1;
  const manualOverride = Math.abs(state.move.x) > 0.015 || Math.abs(state.move.y) > 0.015 ||
    state.throttle || state.braking || state.nitroButton;
  if (manualOverride && ship.userData.earthSurfaceAnchored) {
    ship.userData.earthSurfaceAnchored = false;
  }
  if (manualOverride && shipLandingAutopilot?.snapshot?.().active) {
    cancelLandingGuidance('manual-override');
    if ($('landing-status')) $('landing-status').textContent = 'Comando manual assumido. A orientação foi cancelada e o botão POUSAR foi restaurado.';
    toast('Orientação automática cancelada: controle manual assumido.');
  }

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

  // A dinâmica de propulsão é independente da camada visual e das colisões.
  const boosting = advanceShipFlightDynamics(state, safeDt);

  shipAudio.updateFlight({
    throttle: Boolean(state.throttle && state.fuel > 0),
    boosting,
    braking: Boolean(state.braking),
    moveX: state.move.x,
    moveY: state.move.y,
    speed: state.speed,
    nacellesLit: engineLights.some(light => light.visible && light.intensity > 2),
    dt: safeDt
  });

  /* DESLOCAMENTO */

  // A direção de avanço vem do próprio casco visível: o nariz da nave
  // está no eixo local -Z. Assim, movimento e orientação exibida usam a mesma
  // transformação mundial, sem depender de um grupo intermediário.
  shipVisual.getWorldQuaternion(flightQuaternion);
  forwardVector
    .set(0, 0, -1)
    .applyQuaternion(flightQuaternion)
    .normalize();

  // O eixo frontal do casco é -Z. O vetor é calculado em coordenadas globais;
  // convertemos o próximo ponto de volta ao espaço local do parent antes de gravar.
  // Isso evita misturar vetor world com posição local caso a nave mude de referencial.
  ship.parent?.updateWorldMatrix(true, false);
  const nextShipWorldPosition = ship.getWorldPosition(new THREE.Vector3())
    .addScaledVector(forwardVector, state.speed * safeDt * 0.45);
  if (ship.parent) {
    ship.position.copy(ship.parent.worldToLocal(nextShipWorldPosition));
  } else {
    ship.position.copy(nextShipWorldPosition);
  }

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

  // Primeira resposta física da nave ao relevo real da Earth.
  // A consulta usa a mesma superfície ETOPO que alimenta o mesh visível.
  ship.userData.earthCollisionResolved = false;
  const earthCollisionSurface = earthSystem?.getCollisionSurface?.();
  ship.updateWorldMatrix(true, false);
  const shipWorldPosition = ship.getWorldPosition(new THREE.Vector3());
  const terrainContact = earthCollisionSurface?.sampleWorldPosition?.(shipWorldPosition);
  if (terrainContact?.worldPosition && terrainContact?.worldNormal) {
    const signedClearance = shipWorldPosition.clone()
      .sub(terrainContact.worldPosition)
      .dot(terrainContact.worldNormal);
    const minimumHullClearance = 18;
    if (Number.isFinite(signedClearance) && signedClearance < minimumHullClearance) {
      const correctedWorldPosition = shipWorldPosition.addScaledVector(
        terrainContact.worldNormal,
        minimumHullClearance - signedClearance
      );
      if (ship.parent) {
        ship.parent.updateWorldMatrix(true, false);
        ship.position.copy(ship.parent.worldToLocal(correctedWorldPosition));
      } else {
        ship.position.copy(correctedWorldPosition);
      }
      // Cancela apenas a aproximação contra a superfície; o piloto pode
      // voltar a acelerar para se afastar e decolar.
      if (forwardVector.dot(terrainContact.worldNormal) < 0) state.speed = 0;
      ship.userData.earthCollisionResolved = true;
      ship.userData.earthCollisionClearanceUnits = minimumHullClearance;
    }
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

  // A câmera exterior usa o eixo local do terreno; a câmera interna usa o convés.
  const cameraUp = characterInWorldFrame
    ? new THREE.Vector3(0, 1, 0).applyQuaternion(characterCameraWorldQuaternion).normalize()
    : new THREE.Vector3(0, 1, 0);
  if (characterInWorldFrame && !characterWorldGrounded) {
    const earthCenter = earthSystem?.group?.getWorldPosition(new THREE.Vector3());
    if (earthCenter) cameraUp.copy(characterCameraWorldPosition).sub(earthCenter).normalize();
  }
  camera.up.copy(cameraUp);
  const target = characterCameraWorldPosition.clone().addScaledVector(cameraUp, 1.25);

  if (characterCameraMode === 'first-person') {
    characterCameraOffset.copy(cameraUp).multiplyScalar(1.62);
    camera.position.copy(characterCameraWorldPosition).add(characterCameraOffset);
    characterLookEuler.set(characterPitch, 0, 0, 'YXZ');
    camera.quaternion.copy(characterCameraWorldQuaternion).multiply(
      new THREE.Quaternion().setFromEuler(characterLookEuler)
    );
  } else {
    characterCameraOffset.set(0, 2.35, 5.2).applyQuaternion(characterCameraWorldQuaternion);
    const desired = characterCameraWorldPosition.clone().add(characterCameraOffset);
    // Na primeira apresentação, posiciona a câmera diretamente atrás do piloto.
    // O lerp só começa depois disso; evita a câmera atravessar a cena desde a origem,
    // dando a impressão de que o personagem está caindo/entrando pelo alto.
    if (!characterCameraInitialized) {
      camera.position.copy(desired);
      characterCameraInitialized = true;
    } else {
      camera.position.lerp(desired, 0.22);
    }
    const lookTarget = target.addScaledVector(characterCameraForward, 1.4);
    lookTarget.addScaledVector(cameraUp, Math.sin(characterPitch) * 4.2);
    camera.lookAt(lookTarget);
  }
}

function isD4ExitAperture(position) {
  const radius = 8;
  const aftEdgeZ = 5.5 + 110 * 0.5;
  return position.z >= aftEdgeZ &&
    position.x * position.x + (position.z - aftEdgeZ) ** 2 <= radius ** 2;
}

function isD4BeyondExitAperture(position) {
  const radius = 8;
  const aftEdgeZ = 5.5 + 110 * 0.5;
  const absX = Math.abs(position.x);
  if (absX > radius) return false;
  const outerZ = aftEdgeZ + Math.sqrt(Math.max(0, radius ** 2 - position.x ** 2));
  return position.z > outerZ;
}

function isCharacterInsideDeck(position, deckIndex) {
  const deck = starshipInterior?.layout?.decks?.[deckIndex];
  if (!deck) return false;

  // Medidas dos pisos elípticos (largura, comprimento e centro longitudinal).
  const footprints = {
    D1: [50, 82, -2],
    D2: [50, 94, -2],
    D3: [53, 102, -2],
    D4: [48, 110, 5.5]
  };
  const footprint = footprints[deck.id];
  if (!footprint) return false;

  // Reserva uma margem para o raio do personagem nas bordas do convés.
  const [width, length, centerZ = -2] = footprint;
  const playerRadius = 0.62;
  const radiusX = width * 0.5 - playerRadius;
  const radiusZ = length * 0.5 - playerRadius;
  const normalizedX = position.x / radiusX;
  const normalizedZ = (position.z - centerZ) / radiusZ;
  const insideDeckEllipse =
    normalizedX * normalizedX + normalizedZ * normalizedZ <= 1;

  if (deck.id !== 'D4') return insideDeckEllipse;

  // A meia-lua fica exclusivamente para fora da extremidade traseira do D4.
  // Depois de atravessar sua borda externa, o personagem está fora do piso
  // e pode continuar para fora da nave, entrando em queda livre.
  return insideDeckEllipse || isD4ExitAperture(position) ||
    isD4BeyondExitAperture(position);
}

function isCharacterPositionBlocked(position, deckIndex) {
  const deck = starshipInterior?.layout?.decks?.[deckIndex];
  if (!deck || !isCharacterInsideDeck(position, deckIndex)) return true;

  // D1 e a abertura traseira do D4 não bloqueiam a passagem do personagem.
  if (deck.id === 'D1' || (deck.id === 'D4' &&
      (isD4ExitAperture(position) || isD4BeyondExitAperture(position)))) return false;
  if (deck.id === 'D4' && position.z >= 27 && Math.abs(position.x) <= 10.4) return false;

  const playerRadius = 0.48;
  const feetY = deck.y + 0.21;
  for (const wall of starshipInterior.collisionBoxes || []) {
    if (feetY + 1.8 < wall.y - wall.halfY || feetY > wall.y + wall.halfY) continue;

    const nearestX = THREE.MathUtils.clamp(position.x, wall.x - wall.halfX, wall.x + wall.halfX);
    const nearestZ = THREE.MathUtils.clamp(position.z, wall.z - wall.halfZ, wall.z + wall.halfZ);
    const dx = position.x - nearestX;
    const dz = position.z - nearestZ;

    if (Math.abs(dx) < playerRadius && Math.abs(dz) < playerRadius) return true;
  }
  return false;
}

function transferCharacterToWorldFrame() {
  if (!characterModel?.group || !shipVisual || !scene || characterInWorldFrame) return false;
  const player = characterModel.group;
  if (earthReferenceFrames) earthReferenceFrames.attachToGlobal(player);
  else scene.attach(player);
  characterWorldVelocity.set(0, 0, 0);
  characterInWorldFrame = true;
  characterWorldGrounded = false;
  characterCore.setGrounded(false);
  return true;
}

function anchorCharacterToTerrestrialFrame(player, worldNormal) {
  if (!player || !worldNormal?.isVector3) return false;
  const worldQuaternion = player.getWorldQuaternion(new THREE.Quaternion());
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuaternion);
  if (earthReferenceFrames) {
    earthReferenceFrames.alignToSurface(player, worldNormal, forward);
    earthReferenceFrames.attachToSurface(player);
  } else {
    player.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), worldNormal);
  }
  characterWorldGrounded = true;
  characterWorldVelocity.set(0, 0, 0);
  characterCore.setGrounded(true);
  return true;
}

function updateCharacterWorldPhysics(deltaSeconds) {
  if (!characterInWorldFrame || !characterModel?.group || characterWorldGrounded) return;
  const dt = THREE.MathUtils.clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.05);
  const player = characterModel.group;
  const worldPosition = player.position;
  const earthCenter = earthSystem?.group?.getWorldPosition(new THREE.Vector3());
  const profile = earthSystem?.getPlanetaryProfile?.();
  const radius = profile?.render?.visualRadiusUnits ?? 600;
  const surfaceGravity = profile?.physical?.standardGravityMps2 ?? 9.80665;
  const mu = surfaceGravity * radius * radius;

  if (earthCenter && gravityKernel) {
    const acceleration = gravityKernel.acceleration({
      position: [worldPosition.x, worldPosition.y, worldPosition.z],
      bodies: [{
        position: [earthCenter.x, earthCenter.y, earthCenter.z],
        mu
      }]
    });
    if (acceleration) {
      const nextVelocity = gravityKernel.integrateVelocity(
        [characterWorldVelocity.x, characterWorldVelocity.y, characterWorldVelocity.z],
        acceleration,
        dt,
        180
      );
      if (nextVelocity) characterWorldVelocity.set(...nextVelocity);
    }
  }

  worldPosition.addScaledVector(characterWorldVelocity, dt);

  // O piso do elevador externo tem contato próprio, restrito à sua face
  // superior e somente quando a plataforma está parada no nível terrestre.
  // Isso impede atravessamento sem adicionar colisores laterais ou no casco.
  if (externalElevator?.phase === 'bottom') {
    const platformContact = externalElevator.getPlatformContact?.(worldPosition);
    if (platformContact?.inside && platformContact.clearance <= 0.21 &&
        characterWorldVelocity.dot(platformContact.normal) < 0) {
      worldPosition.copy(platformContact.surfacePoint)
        .addScaledVector(platformContact.normal, 0.21);
      characterWorldVelocity.set(0, 0, 0);
      anchorCharacterToTerrestrialFrame(player, platformContact.normal);
      characterAnimator?.play('land', { restart: true });
      return;
    }
  }

  // A mesma superfície ETOPO usada pelo mesh global fornece o contato.
  // O personagem pousa sobre a normal local, inclusive em montanhas e vales.
  const terrain = earthSystem?.getCollisionSurface?.()
    ?.sampleWorldPosition?.(worldPosition);
  if (terrain?.worldPosition && terrain?.worldNormal) {
    const normal = terrain.worldNormal.clone().normalize();
    const clearance = worldPosition.clone().sub(terrain.worldPosition).dot(normal);
    const inwardSpeed = characterWorldVelocity.dot(normal);
    if (clearance <= 0.21 && inwardSpeed < 0) {
      worldPosition.copy(terrain.worldPosition).addScaledVector(normal, 0.21);
      characterWorldVelocity.set(0, 0, 0);
      anchorCharacterToTerrestrialFrame(player, normal);
      characterAnimator?.play('land', { restart: true });
    }
  }
}

function updateCharacterMovement(dt) {
  if (!characterModel || characterCore.snapshot().mode !== 'on-foot') return;
  if (externalElevator?.moving && externalElevatorRiding) {
    characterAnimator?.play('idle');
    characterAnimator?.update(dt);
    if (characterJumpButton) characterJumpButton.disabled = true;
    return;
  }
  if (characterInWorldFrame) {
    updateCharacterWorldPhysics(dt);
    const worldInput = characterMoveInput;
    const worldMagnitude = Math.min(1, Math.hypot(worldInput.x, worldInput.y));
    let worldMoving = false;

    // O personagem fica no referencial terrestre enquanto caminha. O passo é
    // tangente à superfície e usa o mesmo sampler ETOPO do contato físico.
    if (characterWorldGrounded && worldMagnitude > 0.08) {
      const player = characterModel.group;
      const worldPosition = player.getWorldPosition(new THREE.Vector3());
      const worldQuaternion = player.getWorldQuaternion(new THREE.Quaternion());
      let up = new THREE.Vector3(0, 1, 0).applyQuaternion(worldQuaternion).normalize();
      const currentTerrain = earthSystem?.getCollisionSurface?.()?.sampleWorldPosition?.(worldPosition);
      if (currentTerrain?.worldNormal) up.copy(currentTerrain.worldNormal).normalize();

      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuaternion).projectOnPlane(up).normalize();
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(worldQuaternion).projectOnPlane(up).normalize();
      const direction = forward.multiplyScalar(-worldInput.y).addScaledVector(right, worldInput.x);

      if (direction.lengthSq() > 1e-8) {
        direction.normalize();
        const candidate = worldPosition.clone().addScaledVector(direction, 3.1 * worldMagnitude * dt);
        let contact = null;

        if (externalElevator?.phase === 'bottom') {
          const platformContact = externalElevator.getPlatformContact?.(candidate);
          if (platformContact?.inside && Math.abs(platformContact.clearance) <= 0.85) {
            contact = { worldPosition: platformContact.surfacePoint, worldNormal: platformContact.normal };
          }
        }
        if (!contact) {
          const terrain = earthSystem?.getCollisionSurface?.()?.sampleWorldPosition?.(candidate);
          if (terrain?.worldPosition && terrain?.worldNormal) {
            const normal = terrain.worldNormal.clone().normalize();
            const clearance = candidate.clone().sub(terrain.worldPosition).dot(normal);
            if (clearance >= -0.45 && clearance <= 1.25) {
              contact = { worldPosition: terrain.worldPosition, worldNormal: normal };
            }
          }
        }

        if (contact) {
          const normal = contact.worldNormal.clone().normalize();
          const groundedPosition = contact.worldPosition.clone().addScaledVector(normal, 0.21);
          earthReferenceFrames?.setWorldPosition(player, groundedPosition);
          earthReferenceFrames?.alignToSurface(player, normal, forward);
          characterWorldGrounded = true;
          characterCore.setGrounded(true);
        } else {
          earthReferenceFrames?.attachToGlobal(player);
          earthReferenceFrames?.setWorldPosition(player, candidate);
          characterWorldGrounded = false;
          characterWorldVelocity.set(0, 0, 0);
          characterCore.setGrounded(false);
        }
        worldMoving = true;
      }
    }

    if (worldMoving && characterWorldGrounded) {
      characterFootstepTimer += dt;
      if (characterFootstepTimer >= 0.43) {
        characterFootstepTimer = 0;
        characterAudio.playFootstep();
      }
    } else if (!characterWorldGrounded) {
      characterFootstepTimer = 0;
    }
    if (!characterWorldGrounded) characterAnimator?.play('fall');
    else if (worldMoving) characterAnimator?.play('walk');
    else if (characterAnimator?.current !== 'land') characterAnimator?.play('idle');
    characterAnimator?.update(dt);
    if (characterJumpButton) characterJumpButton.disabled = true;
    return;
  }
  const input = characterMoveInput;
  const magnitude = Math.min(1, Math.hypot(input.x, input.y));
  const deck = characterModel.group.position;
  let movedHorizontally = false;
  const stamina = characterCore.snapshot().stamina;
  const sprinting = characterSprintHeld && magnitude > 0.08 && stamina > 0;
  if (sprinting) characterStaminaAccumulator -= 22 * dt;
  else if (stamina < 100) characterStaminaAccumulator += 13 * dt;

  // Publica energia e atualiza o HUD em intervalos curtos, não a cada frame.
  // Isso evita disparar eventos globais dezenas de vezes por segundo.
  characterStaminaHudTimer += dt;
  if (characterStaminaHudTimer >= 0.1) {
    const staminaNow = THREE.MathUtils.clamp(
      stamina + characterStaminaAccumulator, 0, 100
    );
    if (Math.abs(staminaNow - stamina) >= 0.05) characterCore.setStamina(staminaNow);
    characterStaminaAccumulator = 0;
    characterStaminaHudTimer = 0;
    const displayedStamina = characterCore.snapshot().stamina;
    if (displayedStamina <= 0 && characterSprintHeld) stopCharacterSprint();
    const staminaFill = $('character-stamina');
    const staminaLabel = $('character-stamina-value');
    if (staminaFill) staminaFill.style.width = displayedStamina + '%';
    if (staminaLabel) staminaLabel.textContent = Math.round(displayedStamina) + '%';
  }

  if (magnitude > 0.08) {
    // Movimento horizontal no referencial local da nave; a física vertical
    // é independente da translação/rotação do casco.
    const yaw = characterModel.group.rotation.y;
    characterForward.set(0, 0, -1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    characterRight.set(1, 0, 0).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    characterMove.copy(characterForward).multiplyScalar(-input.y)
      .addScaledVector(characterRight, input.x);

    if (characterMove.lengthSq() > 0) characterMove.normalize();

    const step = (sprinting ? 5.0 : 3.1) * magnitude * dt;
    const previousX = deck.x;
    const previousZ = deck.z;

    // Colisão por eixo preserva o deslizamento junto às paredes.
    deck.x = previousX + characterMove.x * step;
    if (isCharacterPositionBlocked(deck, activeDeckIndex) ||
        !isCharacterInsideDeck(deck, activeDeckIndex)) {
      deck.x = previousX;
    }

    deck.z = previousZ + characterMove.z * step;
    if (isCharacterPositionBlocked(deck, activeDeckIndex) ||
        !isCharacterInsideDeck(deck, activeDeckIndex)) {
      deck.z = previousZ;
    }
    movedHorizontally = Math.hypot(deck.x - previousX, deck.z - previousZ) > 0.0005;
  }

  const leavingDeckThroughAft = activeDeckIndex === 3 &&
    isD4BeyondExitAperture(deck);
  if (leavingDeckThroughAft) {
    characterPhysics?.leaveGround();
    if (transferCharacterToWorldFrame()) {
      updateCharacterWorldPhysics(dt);
      characterAnimator?.play('fall', { restart: true });
      characterAnimator?.update(dt);
      return;
    }
  }
  const floorY = leavingDeckThroughAft
    ? -1000000
    : starshipInterior.layout.decks[activeDeckIndex].y + 0.21;
  if (characterJumpQueued) {
    if (characterPhysics?.jump()) {
      characterAnimator?.play('jump', { restart: true });
      characterAudio.playJump();
    }
    characterJumpQueued = false;
  }

  const physicsState = characterPhysics?.update(dt, {
    position: deck,
    floorY
  });

  if (magnitude > 0.08 && movedHorizontally && physicsState?.grounded) {
    characterFootstepTimer += dt;
    const stepInterval = sprinting ? 0.29 : 0.43;
    if (characterFootstepTimer >= stepInterval) {
      characterFootstepTimer = 0;
      characterAudio.playFootstep();
    }
  } else {
    characterFootstepTimer = 0;
  }

  if (physicsState && characterCore.snapshot().grounded !== physicsState.grounded) {
    characterCore.setGrounded(physicsState.grounded);
  }

  if (characterAnimationTestRemaining > 0) {
    characterAnimationTestRemaining = Math.max(0, characterAnimationTestRemaining - dt);
  }
  if (characterAnimationTestRemaining > 0) {
    // Mantém a pose de teste sem alterar a física nem o deslocamento do personagem.
  } else if (!physicsState?.grounded) {
    characterAnimator?.play(physicsState.velocityY > 0 ? 'jump' : 'fall');
  } else if (physicsState.justLanded) {
    characterAnimator?.play('land', { restart: true });
  } else if (magnitude > 0.08) {
    characterAnimator?.play(sprinting ? 'run' : 'walk');
  } else if (characterAnimator?.current !== 'land') {
    characterAnimator?.play('idle');
  }

  characterAnimator?.update(dt);
  const animationButton = $('character-animation-btn');
  if (animationButton) {
    animationButton.classList.toggle('is-active', characterAnimationTestRemaining > 0);
    if (characterAnimationTestRemaining <= 0) animationButton.querySelector('small').textContent = 'ANIMAÇÃO';
  }
  if (characterJumpButton) characterJumpButton.disabled = !characterPhysics?.grounded;
  if (characterSprintButton) characterSprintButton.disabled = characterCore.snapshot().stamina <= 0;
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
  updateDeck4Clearance();
  const deck = starshipInterior.layout.decks[activeDeckIndex];
  characterModel.group.position.set(0, deck.y + 0.21, 25);
  characterPhysics?.reset(deck.y + 0.21);
  characterCore.setGrounded(true);
  characterAnimator?.play('idle', { restart: true });
  shipAudio.playElevator();
  // O centro do elevador fica dentro da área livre dos quatro decks.
  // Não chamar resolveCharacterShipCollisions: essa função não existe no runtime.
  nearbyElevator = true;
  characterCore.setInteractionTarget('ELEVADOR INTERNO');
  updateElevatorButtons();
  updateCharacterHUD();
  toast('Acesso ao ' + deck.name + ' liberado.');
  return true;
}

function updateExternalElevatorAnimation(dt) {
  if (!externalElevator?.moving) return;
  const reached = externalElevator.update(dt);

  if (externalElevatorRiding && !characterInWorldFrame && characterModel?.group) {
    const feetY = externalElevator.group.position.y + externalElevator.platform.position.y + 0.21;
    characterModel.group.position.set(
      EXTERNAL_ELEVATOR_CONFIG.x,
      feetY,
      EXTERNAL_ELEVATOR_CONFIG.z
    );
    characterModel.group.rotation.y = characterYaw;
    characterPhysics?.reset(feetY);
  }

  if (reached === 'bottom') {
    externalElevatorRiding = false;
    transferCharacterToWorldFrame();
    characterWorldVelocity.set(0, 0, 0);
    characterWorldGrounded = false;
    characterCore.setGrounded(false);
    characterCore.setInteractionTarget('ELEVADOR EXTERNO');
    updateCharacterHUD();
    toast('Você chegou ao exterior da nave.');
  } else if (reached === 'top') {
    externalElevatorRiding = false;
    characterInWorldFrame = false;
    characterWorldGrounded = false;
    characterWorldVelocity.set(0, 0, 0);
    const deckY = starshipInterior.layout.decks[3].y;
    const feetY = deckY + 0.21;
    characterModel.group.position.set(EXTERNAL_ELEVATOR_CONFIG.x, feetY, EXTERNAL_ELEVATOR_CONFIG.z);
    characterPhysics?.reset(feetY);
    characterCore.setGrounded(true);
    characterAnimator?.play('idle', { restart: true });
    characterCore.setInteractionTarget('ELEVADOR EXTERNO');
    updateCharacterHUD();
    toast('Retorno ao Deck 4 concluído.');
  }
}

function activateExternalElevator() {
  if (!externalElevatorActionAvailable || !externalElevator || externalElevator.moving) return false;

  if (externalElevator.phase === 'top') {
    if (characterInWorldFrame || activeDeckIndex !== 3) return false;
    externalElevatorRiding = true;
    const deckY = starshipInterior.layout.decks[3].y;
    characterModel.group.position.set(EXTERNAL_ELEVATOR_CONFIG.x, deckY + 0.21, EXTERNAL_ELEVATOR_CONFIG.z);
    characterPhysics?.reset(deckY + 0.21);
    if (!externalElevator.begin('down')) {
      externalElevatorRiding = false;
      return false;
    }
    toast('Elevador externo descendo.');
  } else if (externalElevator.phase === 'bottom') {
    if (!characterInWorldFrame) return false;
    // Reanexa o personagem à nave preservando a posição mundial no início da subida.
    shipVisual.attach(characterModel.group);
    characterInWorldFrame = false;
    characterWorldGrounded = false;
    characterWorldVelocity.set(0, 0, 0);
    characterCore.setGrounded(false);
    externalElevatorRiding = true;
    const feetY = externalElevator.group.position.y + externalElevator.platform.position.y + 0.21;
    characterModel.group.position.set(EXTERNAL_ELEVATOR_CONFIG.x, feetY, EXTERNAL_ELEVATOR_CONFIG.z);
    characterPhysics?.reset(feetY);
    if (!externalElevator.begin('up')) {
      externalElevatorRiding = false;
      return false;
    }
    toast('Elevador externo subindo.');
  }
  shipAudio.playElevator();
  externalElevatorActionAvailable = false;
  updateExternalElevatorInteraction();
  return true;
}

function updateExternalElevatorInteraction() {
  if (!characterModel || characterCore.snapshot().mode !== 'on-foot' || !externalElevator) return;
  const button = $('character-action-btn');
  if (!button) return;

  if (externalElevator.moving) {
    externalElevatorActionAvailable = false;
    button.classList.remove('hidden');
    button.disabled = true;
    button.textContent = 'ELEVADOR...';
    button.classList.add('available');
    characterCore.setInteractionTarget('ELEVADOR EM MOVIMENTO');
    return;
  }

  let available = false;
  if (externalElevator.phase === 'top' && !characterInWorldFrame && activeDeckIndex === 3) {
    const p = characterModel.group.position;
    const dx = p.x - EXTERNAL_ELEVATOR_CONFIG.x;
    const dz = p.z - EXTERNAL_ELEVATOR_CONFIG.z;
    const deckY = starshipInterior.layout.decks[3].y;
    available = dx * dx + dz * dz <= EXTERNAL_ELEVATOR_CONFIG.interactionRadius ** 2 &&
      Math.abs(p.y - (deckY + 0.21)) <= 2.0;
  } else if (externalElevator.phase === 'bottom' && characterInWorldFrame) {
    characterModel.group.getWorldPosition(pilotPlayerWorldPosition);
    const surface = externalElevator.getPlatformSurfaceWorld();
    const offset = pilotPlayerWorldPosition.clone().sub(surface.center);
    const normalDistance = offset.dot(surface.normal);
    const planarDistance = offset.addScaledVector(surface.normal, -normalDistance).length();
    available = planarDistance <= EXTERNAL_ELEVATOR_CONFIG.interactionRadius &&
      Math.abs(normalDistance) <= 3.2;
  }

  const changed = available !== externalElevatorActionAvailable;
  externalElevatorActionAvailable = available;
  if (available) {
    button.classList.remove('hidden');
    button.disabled = false;
    button.textContent = externalElevator.phase === 'bottom' ? 'SUBIR' : 'DESCER';
    button.classList.add('available');
    if (changed) {
      characterCore.setInteractionTarget('ELEVADOR EXTERNO');
      updateCharacterHUD();
    }
  } else if (changed || button.textContent === 'ELEVADOR...') {
    button.classList.remove('available');
    button.classList.toggle('hidden', nearbyElevator);
    button.disabled = !pilotInteractionAvailable;
    button.textContent = pilotInteractionAvailable ? '◎ PILOTAR' : 'AÇÃO';
    if (nearbyElevator) {
      characterCore.setInteractionTarget('ELEVADOR INTERNO');
    } else {
      characterCore.setInteractionTarget(pilotInteractionAvailable ? 'PILOTAGEM DISPONÍVEL' : null);
    }
    updateCharacterHUD();
  }
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
  characterJumpQueued = false;
  stopCharacterSprint();
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

  cancelLandingGuidance('pilot-disconnected');
  shipComputer.disconnectTerminal('pilot-console');
  characterYaw = returnCharacterToDeck(characterModel, shipVisual, scene);
  characterPitch = 0;
  characterCore.leaveShipSeat();

  characterMoveInput = { x: 0, y: 0 };
  characterJumpQueued = false;
  stopCharacterSprint();
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
  camera.up.set(0, 1, 0);

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

function updateGameplayFrame(dt) {
  if (!active || !renderer) return;

  earthSystem?.update(dt, camera);
  applyEarthSurfaceRotation(dt);
  if (ship) ship.userData.earthCollisionResolved = false;

  updatePhaserWeapon(dt);
  if (characterCore.snapshot().mode === 'on-foot') {
    updateCharacterMovement(dt);
    updateCharacterWeapon(dt);
    updateExternalElevatorAnimation(dt);
    updateElevatorInteraction();
    updatePilotInteraction();
    updateExternalElevatorInteraction();
    updateCharacterCamera();
  } else {
    updateFlight(dt);
    updateCamera();
  }
  // A Earth é proprietária da infraestrutura; a gameplay consulta a base
  // criada pelo módulo para contatos e estado de pouso.
  landingBaseSystem = earthSystem?.getLandingBase?.() ?? null;
  updateShipLandingGuidance(dt);

  // Mantém uma região local de maior densidade geométrica sob a nave
  // durante a aproximação. A consulta usa o mesmo sampler do relevo global.
  if (ship) {
    const collisionSurface = earthSystem?.getCollisionSurface?.();
    const landingPatch = collisionSurface?.updateHighResolutionPatch?.(ship.position);
    if (landingPatch) {
      // Record the center sample and probe five lower-hull points after
      // updateFlight has applied any required terrain-clearance correction.
      ship.userData.earthSurfaceSample =
        collisionSurface.sampleWorldPosition?.(ship.position) ?? null;

      const sampleShipContacts = () => {
        shipVisual.updateWorldMatrix(true, true);
        const pad = landingBaseSystem?.group;
        if (pad) pad.updateWorldMatrix(true, false);
        const probePoints = [...shipEarthContactPoints, ...shipLandingGearContactPoints];
        return probePoints.map(({ id, point }) => {
          const worldPoint = shipVisual.localToWorld(point.clone());
          const terrain = collisionSurface.sampleWorldPosition?.(worldPoint);
          let chosen = terrain?.worldPosition && terrain?.worldNormal
            ? { worldPosition: terrain.worldPosition, worldNormal: terrain.worldNormal, surface: 'etopo' }
            : null;

          // A face superior da plataforma entra na mesma consulta de contato do ETOPO.
          // Não há um segundo motor físico: escolhemos a superfície mais alta sob a sonda.
          if (pad) {
            const padLocal = pad.worldToLocal(worldPoint.clone());
            const insidePad = padLocal.x * padLocal.x + padLocal.z * padLocal.z <= 146 * 146;
            if (insidePad) {
              const padTop = pad.localToWorld(new THREE.Vector3(padLocal.x, 0.76, padLocal.z));
              const padUp = new THREE.Vector3(0, 1, 0).transformDirection(pad.matrixWorld).normalize();
              const padClearance = worldPoint.clone().sub(padTop).dot(padUp);
              const terrainClearance = chosen
                ? worldPoint.clone().sub(chosen.worldPosition).dot(chosen.worldNormal)
                : Infinity;
              if (padClearance < terrainClearance) {
                chosen = { worldPosition: padTop, worldNormal: padUp, surface: 'landing-pad' };
              }
            }
          }

          if (!chosen) return { id, valid: false };
          const clearanceUnits = worldPoint.clone()
            .sub(chosen.worldPosition)
            .dot(chosen.worldNormal);
          return {
            id,
            valid: Number.isFinite(clearanceUnits),
            clearanceUnits,
            worldNormal: chosen.worldNormal,
            surface: chosen.surface,
            penetrating: clearanceUnits < -0.05
          };
        });
      };

      let contacts = sampleShipContacts();
      const worstPenetration = contacts
        .filter(contact => contact.valid && contact.clearanceUnits < -0.05)
        .sort((a, b) => a.clearanceUnits - b.clearanceUnits)[0];
      if (worstPenetration) {
        // Resolve the deepest hull contact, not just the ship's center point.
        const correctedWorldPosition = ship.getWorldPosition(new THREE.Vector3())
          .addScaledVector(worstPenetration.worldNormal, -worstPenetration.clearanceUnits + 0.05);
        if (ship.parent) {
          ship.parent.updateWorldMatrix(true, false);
          ship.position.copy(ship.parent.worldToLocal(correctedWorldPosition));
        } else {
          ship.position.copy(correctedWorldPosition);
        }
        if (forwardVector.dot(worstPenetration.worldNormal) < 0) state.speed = 0;
        ship.userData.earthCollisionResolved = true;
        contacts = sampleShipContacts();
      }

      const validContacts = contacts.filter(contact =>
        contact.valid && Number.isFinite(contact.clearanceUnits)
      );
      const minimumClearance = validContacts.length
        ? Math.min(...validContacts.map(contact => contact.clearanceUnits))
        : null;
      const padUp = landingBaseSystem
        ? new THREE.Vector3(0, 1, 0).transformDirection(landingBaseSystem.group.matrixWorld).normalize()
        : ship.userData.earthSurfaceSample?.worldNormal?.clone?.().normalize() ?? null;
      const shipUp = shipVisual.localToWorld(new THREE.Vector3(0, 1, 0))
        .sub(shipVisual.getWorldPosition(new THREE.Vector3())).normalize();
      const upAlignment = padUp ? THREE.MathUtils.clamp(shipUp.dot(padUp), -1, 1) : null;
      const attitude = upAlignment === null ? 'unavailable'
        : upAlignment >= Math.cos(THREE.MathUtils.degToRad(12)) ? 'upright'
        : upAlignment <= -Math.cos(THREE.MathUtils.degToRad(12)) ? 'inverted'
        : Math.abs(upAlignment) <= Math.sin(THREE.MathUtils.degToRad(12)) ? 'sideways'
        : 'tilted';
      const gearContacts = contacts.filter(contact =>
        contact.id.startsWith('gear-') && contact.valid && contact.clearanceUnits <= 0.35
      );
      if (shipLandingGearContactPoints.length > 0 &&
          gearContacts.length === shipLandingGearContactPoints.length &&
          attitude === 'upright' && minimumClearance !== null &&
          minimumClearance <= 0.35 && Math.abs(state.speed) <= 1.5) {
        ship.userData.earthSurfaceAnchored = true;
      }
      ship.userData.earthLandingContacts = {
        status: validContacts.length !== contacts.length
          ? 'partial'
          : minimumClearance <= 0.35 ? 'contact' : 'clear',
        contacts,
        minimumClearanceUnits: minimumClearance,
        physicsApplied: Boolean(ship.userData.earthCollisionResolved),
        landingGear: {
          total: shipLandingGearContactPoints.length,
          touching: gearContacts.length,
          allTouching: gearContacts.length === shipLandingGearContactPoints.length
        },
        attitude,
        landingComplete: false
      };
    } else {
      delete ship.userData.earthSurfaceSample;
      delete ship.userData.earthLandingContacts;
    }
  }
  orbitSystem?.update(dt);
  asteroidSystem?.update(dt);
  lightingSystem?.update(dt, camera?.position);

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
    // O joystick escreve diretamente no estado consumido por updateFlight.
    // O computador da nave pode monitorar o voo, mas não pode bloquear a entrada.
    state[key].x = nextX;
    state[key].y = nextY;

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

// Controles exclusivos do personagem: salto por toque e corrida por pressão.
const characterJumpButton = $('character-jump-btn');
const characterSprintButton = $('character-sprint-btn');
const characterAnimationButton = $('character-animation-btn');
const characterPhaserButton = $('character-phaser-btn');
const handlePhaserInput = event => {
  if (event.type === 'click' && event.detail !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  firePhaser();
};
characterPhaserButton?.addEventListener('pointerup', handlePhaserInput);
characterPhaserButton?.addEventListener('click', handlePhaserInput);
const characterAimButton = $('character-aim-btn');
characterAimButton?.addEventListener('click', () => {
  if (!isPhaserEquipped() || characterCore.snapshot().mode !== 'on-foot') {
    toast('Equipe o Phaser para usar a mira.');
    return;
  }
  const aiming = characterWeaponController?.toggleAiming() ?? false;
  toast(aiming ? 'Mira ativada.' : 'Arma abaixada.');
});

characterAnimationButton?.addEventListener('click', () => {
  if (characterCore.snapshot().mode !== 'on-foot' || !characterAnimator) return;
  characterAnimationTestIndex = (characterAnimationTestIndex + 1) % characterAnimationTestPoses.length;
  const pose = characterAnimationTestPoses[characterAnimationTestIndex];
  characterAnimationTestRemaining = pose === 'idle' ? 1.1 : 1.45;
  characterAnimator.play(pose, { restart: true });
  characterAnimationButton.classList.add('is-active');
  characterAnimationButton.querySelector('small').textContent = pose.toUpperCase();
  toast('Teste de animação: ' + pose.toUpperCase());
});

characterJumpButton?.addEventListener('pointerdown', event => {
  event.preventDefault();
  if (characterCore.snapshot().mode !== 'on-foot' || !characterPhysics?.grounded) return;
  characterJumpQueued = true;
});

const stopCharacterSprint = () => {
  characterSprintHeld = false;
  characterSprintButton?.classList.remove('is-active');
};
characterSprintButton?.addEventListener('pointerdown', event => {
  event.preventDefault();
  if (characterCore.snapshot().mode !== 'on-foot') return;
  characterSprintHeld = true;
  characterSprintButton.classList.add('is-active');
  characterSprintButton.setPointerCapture(event.pointerId);
});
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type =>
  characterSprintButton?.addEventListener(type, stopCharacterSprint)
);

window.addEventListener('keydown', event => {
  if (characterCore.snapshot().mode !== 'on-foot' || event.repeat) return;
  if (event.code === 'Space') {
    event.preventDefault();
    if (characterPhysics?.grounded) characterJumpQueued = true;
  }
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') characterSprintHeld = true;
});
window.addEventListener('keyup', event => {
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') stopCharacterSprint();
});
window.addEventListener('blur', stopCharacterSprint);

function updateCharacterWeapon(dt) {
  const equipped = isPhaserEquipped();
  if (!equipped) characterWeaponController?.reset();
  const result = characterWeaponController?.update(dt, characterPitch);
  const aimButton = $('character-aim-btn');
  const reticle = $('character-aim-reticle');
  if (aimButton) {
    aimButton.disabled = !equipped;
    aimButton.classList.toggle('is-active', Boolean(result?.aiming));
    const label = aimButton.querySelector('small');
    if (label) label.textContent = !equipped ? 'SEM ARMA' : result?.aiming ? 'MIRANDO' : 'MIRAR';
  }
  if (reticle) reticle.classList.toggle('is-visible', equipped && Boolean(result?.aiming));
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
    const yawDelta = -dx * 0.005;
    characterYaw += yawDelta;
    characterPitch = THREE.MathUtils.clamp(characterPitch - dy * 0.004, -0.65, 0.65);
    // A guinada exterior gira ao redor da normal local, nunca do Y global.
    if (characterModel?.group && characterInWorldFrame) {
      const player = characterModel.group;
      const worldPosition = player.getWorldPosition(new THREE.Vector3());
      const earthCenter = earthSystem?.group?.getWorldPosition(new THREE.Vector3());
      const up = characterWorldGrounded
        ? new THREE.Vector3(0, 1, 0).applyQuaternion(player.getWorldQuaternion(new THREE.Quaternion())).normalize()
        : earthCenter ? worldPosition.sub(earthCenter).normalize() : new THREE.Vector3(0, 1, 0);
      earthReferenceFrames?.rotateAroundWorldAxis(player, up, yawDelta);
    } else if (characterModel?.group) {
      characterModel.group.rotation.y = characterYaw;
    }
  });
  const endCharacterAim = event => {
    if (characterAimPointer === event.pointerId) characterAimPointer = null;
  };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type =>
    characterAim.addEventListener(type, endCharacterAim)
  );
}

$('character-action-btn')?.addEventListener('click', () => {
  if (externalElevatorActionAvailable) activateExternalElevator();
  else enterPilotMode();
});
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
const characterEquipment = createCharacterEquipmentSystem(state, {
  applyVisual(slot, itemId) {
    if (characterModel) characterModel.setEquipment(slot, itemId);
  },
  onChange() {
    characterAudio.playEquip();
    renderClothing();
    renderInventory();
    characterCore.setEquipment('suit', characterEquipment.equippedItem('torso')?.itemId || null);
    for (const slot of ['head', 'torso', 'hands', 'legs', 'feet', 'back', 'weapon']) {
      characterCore.setEquipment(slot, characterEquipment.equippedItem(slot)?.itemId || null);
    }
    save();
  }
});

function renderClothing() {
  const labels = { head: 'CABEÇA', torso: 'PEITORAL', hands: 'LUVAS', legs: 'CALÇAS', feet: 'BOTAS', back: 'COSTAS', weapon: 'ARMA' };
  for (const [slot] of Object.entries(labels)) {
    const button = document.querySelector(`[data-slot="${slot}"]`);
    if (!button) continue;
    const item = characterEquipment.equippedItem(slot);
    const name = button.querySelector('b');
    const status = button.querySelector('small');
    if (name) name.textContent = item?.name || 'Vazio';
    if (status) status.textContent = item ? 'EQUIPADO · TOQUE PARA REMOVER' : 'VAZIO · TOQUE PARA EQUIPAR';
    button.classList.toggle('selected', Boolean(item));
  }
}

let pendingInventoryEquipId = null;

function renderInventory() {
  renderClothing();
  const grid = $('inventory-grid');
  if (!grid) return;
  const snapshot = characterEquipment.snapshot();
  const items = snapshot.items || [];
  const overflowItems = snapshot.overflowItems || [];
  const capacity = snapshot.capacity || 12;
  const backpack = characterEquipment.equippedItem('back');
  const usedWeight = snapshot.usedWeight || 0;
  const maxWeight = snapshot.maxWeight ?? 60;

  $('inventory-count').textContent = `${items.length} / ${capacity}`;
  $('inventory-count').title = `Peso: ${usedWeight.toFixed(1)} / ${maxWeight} kg`;
  if ($('inventory-backpack-name')) $('inventory-backpack-name').textContent = backpack?.name || 'SEM MOCHILA';
  if ($('inventory-backpack-code')) $('inventory-backpack-code').textContent = backpack?.code || 'CAPACIDADE BASE';
  if ($('inventory-backpack-capacity')) $('inventory-backpack-capacity').textContent = `${capacity} ESPAÇOS`;
  if ($('inventory-backpack-weight')) $('inventory-backpack-weight').textContent = `${usedWeight.toFixed(1)} / ${maxWeight} KG`;
  if ($('inventory-overflow-count')) $('inventory-overflow-count').textContent = String(overflowItems.length);
  $('inventory-overflow-panel')?.classList.toggle('hidden', overflowItems.length === 0);

  grid.innerHTML = Array.from({ length: capacity }, (_, index) => {
    const item = items[index];
    if (!item) return '<div class="inventory-cell empty"><span>ESPAÇO LIVRE</span></div>';
    const name = escapeHtml(item.name || item.itemId || item.definitionId);
    const category = escapeHtml(item.category || 'ITEM').toUpperCase();
    const quantity = item.quantity > 1 ? ` ×${item.quantity}` : '';
    return `<button class="inventory-cell inventory-item-button" type="button" data-item-instance="${escapeHtml(item.instanceId)}">
      <span>${name}${quantity}</span><small>${category} · TOQUE PARA EQUIPAR</small>
    </button>`;
  }).join('');

  const overflowGrid = $('inventory-overflow-grid');
  if (overflowGrid) {
    overflowGrid.innerHTML = overflowItems.map(item => {
      const name = escapeHtml(item.name || item.itemId || item.definitionId);
      const quantity = item.quantity > 1 ? ` ×${item.quantity}` : '';
      const equipable = ['head', 'torso', 'hands', 'legs', 'feet', 'back', 'weapon'].includes(item.slot);
      const pending = pendingInventoryEquipId === item.instanceId;
      const action = equipable ? (pending ? 'EQUIPAR AGORA' : 'TOQUE PARA SELECIONAR') : 'TOQUE PARA RESTAURAR';
      return `<button type="button" class="inventory-overflow-item${pending ? ' item-pending-equip' : ''}" data-overflow-instance-id="${escapeHtml(item.instanceId)}">
        <b>${name}${quantity}</b><small>${action}</small>
      </button>`;
    }).join('');
  }

  const equipment = state.inventory?.equipment || {};
  ['weapon', 'tool', 'machine'].forEach(slot => {
    const el = $('quick-' + slot);
    if (el) {
      const equipped = Boolean(equipment[slot]);
      el.textContent = equipment[slot]?.name || equipment[slot] || 'VAZIO';
      el.closest('.quick-slot')?.classList.toggle('is-equipped', equipped);
      el.closest('.quick-slot')?.setAttribute('aria-label', `${slot}: ${equipped ? el.textContent : 'vazio'}`);
    }
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
$('inventory-clothing-view')?.addEventListener('click', event => {
  const button = event.target.closest('button[data-slot]');
  if (!button || !event.currentTarget.contains(button)) return;
  const result = characterEquipment.toggleSlot(button.dataset.slot);
  if (!result.ok) toast(result.reason);
  else {
    save();
    toast(result.item?.name ? result.item.name + ' atualizado.' : 'Equipamento atualizado.');
  }
});
$('inventory-grid')?.addEventListener('click', event => {
  const target = event.target.closest('[data-item-instance]');
  if (!target) return;
  const result = characterEquipment.equip(target.dataset.itemInstance);
  pendingInventoryEquipId = null;
  if (!result.ok) toast(result.reason);
  else { save(); toast(result.item.name + ' equipado no personagem.'); }
  renderInventory();
});
$('inventory-overflow-grid')?.addEventListener('click', event => {
  const target = event.target.closest('[data-overflow-instance-id]');
  if (!target) return;
  const instanceId = target.dataset.overflowInstanceId;
  const item = characterEquipment.snapshot().overflowItems.find(entry => entry.instanceId === instanceId);
  if (!item) return;
  const equipable = ['head', 'torso', 'hands', 'legs', 'feet', 'back', 'weapon'].includes(item.slot);
  if (equipable) {
    if (pendingInventoryEquipId !== instanceId) {
      pendingInventoryEquipId = instanceId;
      renderInventory();
      return;
    }
    const result = characterEquipment.equip(instanceId);
    pendingInventoryEquipId = null;
    if (!result.ok) toast(result.reason);
    else { save(); toast(result.item.name + ' equipado no personagem.'); }
    renderInventory();
    return;
  }
  pendingInventoryEquipId = null;
  const result = characterEquipment.moveOverflowToInventory(instanceId);
  if (!result.ok) toast('Ainda não há espaço ou peso disponível na mochila.');
  else { save(); toast('Item restaurado para a mochila.'); }
  renderInventory();
});
save();
renderInventory();
$('leave-pilot-btn')?.addEventListener('click', exitPilotMode);

if ($('character-action-btn')) $('character-action-btn').disabled = true;

// Ao perder foco no Android, zera entradas para impedir joystick ou aceleração presos.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    resetTransientState();
    if (runtimeBridge?.status === 'running') runtimeBridge.pause();
  } else if (active && runtimeBridge?.status === 'paused') {
    runtimeBridge.resume();
  }
});

registerAimControls({ document, THREE, state, shipComputer });
registerHeldFlightControls({ document, window, state });
registerFlightSelectionGuards({ document });

function cancelLandingGuidance(reason = 'cancelled') {
  shipLandingAutopilot?.cancel?.();
  shipLandingTelemetry.reset();
  selectedLandingSiteId = null;
  if (ship) {
    ship.userData.landingGuidance = null;
    delete ship.userData.landingTelemetry;
    delete ship.userData.landingGearMetricDiagnostics;
    ship.userData.landingAutopilotState = reason;
  }
  const button = $('landing-btn');
  if (button) button.textContent = '◉ POUSAR';
}

$('landing-btn')?.addEventListener('click', () => {
  if (!active || characterCore.snapshot().mode !== 'ship-control') return;

  if (shipLandingAutopilot?.snapshot?.().active) {
    cancelLandingGuidance('standby');
    shipAudio.playConsole();
    if ($('landing-status')) $('landing-status').textContent = 'Orientação cancelada. Selecione novamente POUSAR para escolher um destino.';
    toast('Guia de pouso cancelada.');
    return;
  }

  if (selectedLandingSiteId && shipLandingAutopilot) {
    const site = getLandingSite(selectedLandingSiteId);
    if (!site || !shipLandingAutopilot.arm(site)) {
      toast('Não foi possível ativar a orientação de pouso.');
      return;
    }
    shipLandingTelemetry.reset();
    ship.userData.landingAutopilotState = 'armed-guidance-only';
    shipAudio.playLandingAlert();
    $('landing-status').textContent = 'Telemetria conectada. A orientação calcula a aproximação, mas não comanda a propulsão nesta versão.';
    $('landing-btn').textContent = '✕ CANCELAR';
    toast('Guia de pouso ativada. Propulsão automática permanece bloqueada.');
    return;
  }

  $('landing-modal')?.classList.remove('hidden');
  $('landing-modal')?.setAttribute('aria-hidden', 'false');
});

function updateShipLandingGuidance(dt) {
  if (!ship || !shipVisual || !shipLandingAutopilot?.snapshot?.().active) return;
  const platform = landingBaseSystem?.platform;
  if (!platform || !shipFlightKernel) {
    ship.userData.landingGuidance = null;
    ship.userData.landingAutopilotState = 'waiting-for-landing-platform';
    return;
  }

  // A inversão da matriz da plataforma desfaz também a escala métrica
  // herdada pela raiz da base: o resultado já está em metros.
  shipVisual.updateWorldMatrix(true, true);
  platform.updateWorldMatrix(true, true);
  const shipOriginWorld = shipVisual.getWorldPosition(new THREE.Vector3());
  const shipOriginPlatformLocal = platform.worldToLocal(shipOriginWorld.clone());
  const platformWorldQuaternion = platform.getWorldQuaternion(new THREE.Quaternion());
  const shipWorldQuaternion = shipVisual.getWorldQuaternion(new THREE.Quaternion());
  const shipRotationRelativeToPlatform = platformWorldQuaternion
    .invert().multiply(shipWorldQuaternion).normalize();

  const telemetry = shipLandingTelemetry.sample({
    shipOriginPlatformLocalMeters: shipOriginPlatformLocal.toArray(),
    shipRotationRelativeToPlatform: [
      shipRotationRelativeToPlatform.x, shipRotationRelativeToPlatform.y,
      shipRotationRelativeToPlatform.z, shipRotationRelativeToPlatform.w
    ],
    contactPoints: shipLandingGearContactPoints.map(({ id, point }) => ({
      id, point: point.toArray()
    })),
    dt: Math.max(dt, 1 / 240)
  });
  if (!telemetry) {
    ship.userData.landingGuidance = null;
    ship.userData.landingAutopilotState = 'invalid-metric-telemetry';
    return;
  }

  const guidance = shipLandingAutopilot.update(telemetry);
  ship.userData.landingTelemetry = telemetry;
  ship.userData.landingGearMetricDiagnostics = {
    contactPoints: telemetry.contactPointsMeters,
    allGearInsideDeck: telemetry.allGearInsideDeck,
    minimumGearClearanceMeters: telemetry.minimumGearClearanceMeters,
    maximumGearClearanceMeters: telemetry.maximumGearClearanceMeters,
    modelMetersPerUnit: telemetry.modelMetersPerUnit,
    coordinateFrame: telemetry.coordinateFrame
  };
  ship.userData.landingGuidance = guidance;
  ship.userData.landingAutopilotState = guidance ? 'guidance-only' : 'guidance-unavailable';
  if (guidance) {
    guidance.backend = shipFlightKernel.backend;
    guidance.actuationEnabled = false;
    guidance.coordinateFrame = telemetry.coordinateFrame;
    guidance.gearClearanceMeters = telemetry.minimumGearClearanceMeters;
    guidance.allGearInsideDeck = telemetry.allGearInsideDeck;
    guidance.scaleValidation = telemetry.scaleValidation;
  }
}

function closeLandingPanel() {
  $('landing-modal')?.classList.add('hidden');
  $('landing-modal')?.setAttribute('aria-hidden', 'true');
}

$('landing-close-btn')?.addEventListener('click', closeLandingPanel);

$('landing-select-btn')?.addEventListener('click', () => {
  const site = getLandingSite('earth-salar-test-candidate');
  if (!site || !ship) {
    toast('O destino de pouso ainda não está disponível.');
    return;
  }
  selectedLandingSiteId = site.id;
  shipLandingAutopilot?.cancel?.();
  shipLandingTelemetry.reset();
  ship.userData.landingSiteId = site.id;
  ship.userData.landingAutopilotState = 'target-selected';
  const button = $('landing-btn');
  if (button) button.textContent = '◎ ATIVAR GUIA DE POUSO';
  const status = $('landing-status');
  if (status) status.textContent = 'Destino marcado: Salar de Uyuni · UY04. Ative a guia quando estiver pronto. A orientação calcula a aproximação, mas ainda não comanda a propulsão.';
  closeLandingPanel();
  toast('Destino UY04 marcado. Telemetria pronta para conexão.');
});

/* CÂMERAS */

registerCameraCycleControl({ document, state, cameraNames });

registerGameplayActions({
  document,
  THREE,
  getElement: $,
  state,
  isActive: () => active,
  getAsteroids: () => asteroids,
  getShip: () => ship,
  getAsteroidSystem: () => asteroidSystem,
  setAsteroids: value => { asteroids = value; },
  save,
  updateWallet,
  shipAudio,
  characterAudio,
  toast,
  getNpcReady: () => npcReady,
  setNpcReady: value => { npcReady = value; }
});

/* Editor do HUD do personagem: não move nem modifica o HUD da nave. */
const characterHudEditor = $('character-hud-editor');
const characterHudEditable = [...document.querySelectorAll('[data-hud-editable]')];
let characterHudEditing = false;
let characterHudBeforeEdit = null;
let characterHudDrag = null;

function readCharacterHudLayout() {
  return state.settings?.characterHudLayout && typeof state.settings.characterHudLayout === 'object'
    ? structuredClone(state.settings.characterHudLayout)
    : {};
}

function applyCharacterHudLayout(layout = {}) {
  characterHudEditable.forEach(element => {
    const saved = layout[element.dataset.hudEditable];
    if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) {
      ['position', 'left', 'top', 'right', 'bottom', 'transform'].forEach(prop => element.style.removeProperty(prop));
      return;
    }
    const rect = element.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, saved.x));
    const y = Math.max(0, Math.min(1, saved.y));
    element.style.position = 'fixed';
    element.style.left = `${x * Math.max(1, window.innerWidth - rect.width)}px`;
    element.style.top = `${y * Math.max(1, window.innerHeight - rect.height)}px`;
    element.style.right = 'auto';
    element.style.bottom = 'auto';
    element.style.transform = 'none';
  });
}

function scheduleCharacterHudLayout() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const gameScreen = $('game-screen');
    if (!gameScreen || gameScreen.classList.contains('hidden')) return;

    const hasMeasuredHud = characterHudEditable.every(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    if (!hasMeasuredHud) return;

    applyCharacterHudLayout(readCharacterHudLayout());
  }));
}

function captureCharacterHudLayout() {
  const layout = {};
  characterHudEditable.forEach(element => {
    const rect = element.getBoundingClientRect();
    layout[element.dataset.hudEditable] = {
      x: Math.max(0, Math.min(1, rect.left / Math.max(1, window.innerWidth - rect.width))),
      y: Math.max(0, Math.min(1, rect.top / Math.max(1, window.innerHeight - rect.height)))
    };
  });
  return layout;
}

function finishCharacterHudEditing({ saveChanges = false, reset = false } = {}) {
  if (!characterHudEditing) return;
  state.settings ||= {};
  if (reset) {
    delete state.settings.characterHudLayout;
    applyCharacterHudLayout({});
  } else if (saveChanges) {
    state.settings.characterHudLayout = captureCharacterHudLayout();
    save();
  } else {
    applyCharacterHudLayout(characterHudBeforeEdit || {});
  }
  characterHudEditing = false;
  characterHudDrag = null;
  characterHudEditable.forEach(element => element.classList.remove('hud-editable-active'));
  characterHudEditor?.classList.add('hidden');
  characterHudEditor?.setAttribute('aria-hidden', 'true');
  if (reset) save();
}

function startCharacterHudEditing() {
  if (characterHudEditing) return;
  characterHudBeforeEdit = readCharacterHudLayout();
  applyCharacterHudLayout(characterHudBeforeEdit);
  characterHudEditing = true;
  $('game-menu-modal')?.classList.add('hidden');
  characterHudEditor?.classList.remove('hidden');
  characterHudEditor?.setAttribute('aria-hidden', 'false');
  characterHudEditable.forEach(element => element.classList.add('hud-editable-active'));
  // O editor é aberto a partir do menu de pausa, que já interrompeu o Runtime.
  // Ao ocultar o menu, retoma a simulação para que SALVAR/CANCELAR não deixem
  // a gameplay presa no estado pausado.
  if (runtimeBridge?.status === 'paused') runtimeBridge.resume();
  toast('Arraste os elementos do HUD. Depois toque em SALVAR.');
}

characterHudEditable.forEach(element => {
  element.addEventListener('pointerdown', event => {
    if (!characterHudEditing || (event.target.closest('button') && element.dataset.hudEditable !== 'action')) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = element.getBoundingClientRect();
    element.style.position = 'fixed';
    element.style.left = `${rect.left}px`;
    element.style.top = `${rect.top}px`;
    element.style.right = 'auto';
    element.style.bottom = 'auto';
    element.style.transform = 'none';
    characterHudDrag = { element, pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    element.setPointerCapture?.(event.pointerId);
  });
  element.addEventListener('pointermove', event => {
    if (!characterHudEditing || !characterHudDrag || characterHudDrag.element !== element || characterHudDrag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const rect = element.getBoundingClientRect();
    const x = Math.max(0, Math.min(window.innerWidth - rect.width, event.clientX - characterHudDrag.offsetX));
    const y = Math.max(0, Math.min(window.innerHeight - rect.height, event.clientY - characterHudDrag.offsetY));
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  });
  const endDrag = event => {
    if (characterHudDrag?.element === element && characterHudDrag.pointerId === event.pointerId) characterHudDrag = null;
  };
  element.addEventListener('pointerup', endDrag);
  element.addEventListener('pointercancel', endDrag);
});

$('edit-character-hud-btn')?.addEventListener('click', startCharacterHudEditing);
$('character-hud-save-btn')?.addEventListener('click', () => finishCharacterHudEditing({ saveChanges: true }));
$('character-hud-cancel-btn')?.addEventListener('click', () => finishCharacterHudEditing());
$('character-hud-reset-btn')?.addEventListener('click', () => finishCharacterHudEditing({ reset: true }));
applyCharacterHudLayout(readCharacterHudLayout());

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
  if (runtimeBridge?.status === 'running') runtimeBridge.pause();
});

$('game-menu-btn')?.addEventListener('click', () => {
  if (runtimeBridge?.status === 'running') runtimeBridge.pause();
  state.throttle = false;
  state.braking = false;
  state.nitroButton = false;

  $('game-menu-modal')?.classList.remove('hidden');
});

$('resume-btn')?.addEventListener('click', () => {
  $('game-menu-modal')?.classList.add('hidden');
  if (runtimeBridge?.status === 'paused') runtimeBridge.resume();
});

$('return-menu-btn')?.addEventListener('click', async () => {
  // Nunca abandonar a sessão enquanto o personagem ainda estiver sentado
  // no console: libera o terminal, devolve o personagem ao convés e
  // restaura o HUD a pé antes de ocultar a tela do jogo.
  if (characterCore.snapshot().mode === 'ship-control') {
    exitPilotMode();
  } else {
    // Recupera também uma eventual conexão órfã do computador da nave.
    shipComputer.disconnectTerminal('pilot-console');
  }

  active = false;
  await runtimeBridge?.shutdown();
  resetTransientState();
  characterMoveInput = { x: 0, y: 0 };

  const characterStickKnob = $('character-move-stick')?.querySelector('.character-move-knob');
  if (characterStickKnob) characterStickKnob.style.transform = 'translate(0,0)';

  $('game-menu-modal')?.classList.add('hidden');
  $('inventory-modal')?.classList.add('hidden');
  $('loading-screen')?.classList.add('hidden');
  $('npc-bubble')?.classList.add('hidden');
  $('toast')?.classList.add('hidden');

  save();
  // Reconstrói o painel Jogar para garantir que o botão DECOLAR e seus
  // eventos estejam ativos após qualquer retorno da gameplay.
  renderPanel('play');
  show('menu-screen');
  updateWallet();
});

// A tela de entrada é exibida somente depois que o carregamento inicial termina.
bootApplication();
