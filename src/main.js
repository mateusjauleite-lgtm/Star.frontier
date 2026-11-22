import * as THREE from 'three';
import { registerAimControls, registerHeldFlightControls, registerFlightSelectionGuards, registerCameraCycleControl } from './controls/gameControls.js';
import { registerCharacterControls } from './controls/characterControls.js';
import { registerGameplayActions } from './systems/gameplayActions.js';
import { createMiningRuntimeSystem } from './systems/miningSystem.js';
import { loadRuntimeKernel } from './core/runtime/RuntimeKernel.js';
import { createRuntimeBridge } from './core/runtime/RuntimeBridge.js';
import { createRuntimeVisibilityHandler } from './core/runtime/RuntimeVisibility.js';
import { registerGameRuntimeSystems } from './core/runtime/systems/registerGameRuntimeSystems.js';
import { createGameplayFramePhases } from './core/runtime/gameplayFramePhases.js';
import { registerGameWorldEntities } from './core/entities/GameEntityBindings.js';
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
const DILITHIUM_ORE_ITEM_ID = 'ore.dilithium.raw';
import { isPilotConsoleInRange, attachCharacterToPilotConsole, returnCharacterToDeck } from './ships/bridge/commandBridge.js';
import { saveState as save, loadState as load } from './core/storage.js';
import { createShipComputer } from './ships/computer/shipComputer.js';
import { createShipManagementTerminalController, SHIP_MANAGEMENT_TERMINAL_LOCAL_POSITION, SHIP_MANAGEMENT_TERMINAL_DISPLAY_RADIUS, SHIP_MANAGEMENT_TERMINAL_INTERACTION_RADIUS } from './ships/computer/managementTerminal/managementTerminalController.js';
import { createShipManagementTerminalRenderer } from './ships/computer/managementTerminal/managementTerminalRenderer.js';
import { createShipManagementHologram, createRefineryHologram } from './ships/computer/managementTerminal/shipManagementHologram.js';
import { createEngineeringTerminalController, ENGINEERING_CONSOLE_LOCAL_POSITION, ENGINEERING_CONSOLE_DISPLAY_RADIUS, ENGINEERING_CONSOLE_INTERACTION_RADIUS } from './ships/computer/engineeringTerminalController.js';
import { createEngineeringTerminalRenderer } from './ships/computer/engineeringTerminal/engineeringTerminalRenderer.js';
import { createRefineryTerminalController, REFINERY_TERMINAL_LOCAL_POSITION, REFINERY_TERMINAL_DISPLAY_RADIUS, REFINERY_TERMINAL_INTERACTION_RADIUS } from './ships/computer/refineryTerminalController.js';
import { createRefineryTerminalRenderer } from './ships/computer/refineryTerminal/refineryTerminalRenderer.js';
import { registerShipComputerSystems } from './ships/computer/shipComputerSystems.js';
import { advanceShipFlightDynamics } from './ships/flight/flightDynamics.js';
import { createShipFlightController } from './ships/flight/shipFlightController.js';
import { createArtificialGravityField } from './ships/systems/artificialGravityField.js';
import { createShipShieldSystem } from './ships/systems/shieldSystem.js';
import { createDilithiumRefinerySystem } from './ships/systems/dilithiumRefinerySystem.js';
import { registerTextInteractionGuard } from './core/ui/textInteractionGuard.js';
import { createPilotHudProfileStore, PILOT_HUD_PROFILES } from './ui/hudProfiles.js';

const artificialGravityField = createArtificialGravityField();
const shipShieldSystem = createShipShieldSystem(state);
const dilithiumRefinerySystem = createDilithiumRefinerySystem(state, { getPlant: () => starshipInterior?.dilithiumPlant, persist: save });

registerTextInteractionGuard();

const $ = id => document.getElementById(id);

// Os layouts do HUD são dados JSON simples; mantenha compatibilidade com WebViews sem structuredClone.
function cloneHudData(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return value;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const characterCore = createCharacterCore();
const characterAudio = createCharacterAudio({ core: characterCore });
characterAudio.attach();
const shipAudio = createShipAudio();
const shipComputer = createShipComputer();
shipComputer.registerTerminal({
  id: 'ship-management-terminal',
  name: 'Terminal holográfico de gerenciamento',
  systems: ['navigation', 'sensors', 'engineering', 'power', 'shields']
});
shipComputer.registerTerminal({ id: 'pilot-console', name: 'Console de pilotagem da Ponte', systems: ['navigation', 'propulsion', 'shields'] });
shipComputer.registerTerminal({ id: 'engineering-console', name: 'Console de Engenharia · Deck 3', systems: ['engineering', 'propulsion', 'power', 'shields'] });
shipComputer.registerTerminal({ id: 'refinery-console', name: 'Console da Refinaria · Deck 3', systems: ['refinery'] });
const shipManagementTerminal = createShipManagementTerminalController({
  computer: shipComputer,
  renderer: createShipManagementTerminalRenderer({ root: $('game-screen') }),
  onInteractionChange: active => {
    $('game-screen')?.classList.toggle('ship-management-active', active);
    if (active) characterControls?.reset?.();
  }
});
let engineeringConsoleActive = false;
let engineeringTerminal = null;
let engineeringTelemetryAccumulator = 0;
let refineryTerminal = null;
let refineryConsoleActive = false;
let refineryInteractionAvailable = false;
let refineryTelemetryAccumulator = 0;
let managementTelemetryAccumulator = 0;
const engineeringRenderer = createEngineeringTerminalRenderer({
  root: $('game-screen'),
  onOpen: () => toggleEngineeringConsole(),
  onClose: () => toggleEngineeringConsole(),
  onStageSelect: stage => {
    const response = engineeringTerminal?.dispatch('engineering', 'setWarpStage', { stage });
    if (!response?.ok || !response.result?.accepted) toast('Não foi possível alterar o estágio de dobra.');
  },
  onExitMode: mode => {
    const response = engineeringTerminal?.dispatch('engineering', 'setWarpExitMode', { mode });
    if (!response?.ok || !response.result?.accepted) toast('Modo de saída não disponível.');
  },
  onWarpToggle: active => {
    const response = engineeringTerminal?.dispatch('engineering', 'setWarpActive', { active });
    if (!response?.ok || !response.result?.accepted) toast('Dobra indisponível: verifique o dilítio refinado.');
  },
});
engineeringRenderer.mount();
const refineryRenderer = createRefineryTerminalRenderer({ root: $('game-screen') });
refineryTerminal = createRefineryTerminalController({
  computer: shipComputer,
  renderer: refineryRenderer,
  onInteractionChange: active => {
    refineryConsoleActive = active;
    if (!active) document.querySelector('[data-refinery-receiving-slot]')?.classList.remove('is-receiving');
  },
  onReceive: () => {
    if (!refineryConsoleActive) { toast('Conecte-se ao console da Refinaria para receber minério.'); return; }
    const receivingSlot = document.querySelector('[data-refinery-receiving-slot]');
    receivingSlot?.classList.add('is-receiving');
    const receiveHint = receivingSlot?.querySelector('[data-refinery-receive-hint]');
    if (receiveHint) receiveHint.textContent = 'AGUARDANDO MINÉRIO DO INVENTÁRIO DO PERSONAGEM';
    renderInventory();
    openInventory();
    toast('Compartimento de recebimento ativo. Toque no minério para transferir.');
  }
});
engineeringTerminal = createEngineeringTerminalController({
  computer: shipComputer,
  onInteractionChange: active => {
    engineeringConsoleActive = active;
    engineeringRenderer.setOpen(active);
    if (active) {
      const response = engineeringTerminal?.dispatch('engineering', 'status');
      if (response?.ok) engineeringRenderer.update(response.result);
    }
  }
});
const characterHUD = createCharacterHUD(document);
let characterCameraMode = 'third-person';
let characterCameraInitialized = false;
let characterModel = null;
let shipManagementHologram = null;
let engineeringHologram = null;
let refineryHologram = null;
let characterAnimator = null;
let characterWeaponController = null;
let characterPhysics = null;
let shieldVisual = null;
let characterYaw = 0;
let characterPitch = 0;
const characterForward = new THREE.Vector3();
const characterRight = new THREE.Vector3();
const characterMove = new THREE.Vector3();
const characterLookEuler = new THREE.Euler(0, 0, 0, 'YXZ');
let characterFootstepTimer = 0;
let characterAnimationTestRemaining = 0;
let characterAnimationTestIndex = -1;
const characterAnimationTestPoses = ['walk', 'run', 'jump', 'fall', 'land', 'sit', 'stand', 'idle'];
let characterStaminaAccumulator = 0;
let characterStaminaHudTimer = 0;
let phaserChargeRemaining = 0;
let phaserShotFlashRemaining = 0;
const PHASER_RECHARGE_SECONDS = 2.5;
const PHASER_FLASH_SECONDS = 0.16;
let pilotInteractionAvailable = false;
let shipManagementInteractionAvailable = false;
let engineeringInteractionAvailable = false;
const shipManagementTerminalPosition = new THREE.Vector3(
  SHIP_MANAGEMENT_TERMINAL_LOCAL_POSITION.x,
  SHIP_MANAGEMENT_TERMINAL_LOCAL_POSITION.y,
  SHIP_MANAGEMENT_TERMINAL_LOCAL_POSITION.z
);
const engineeringConsolePosition = new THREE.Vector3(
  ENGINEERING_CONSOLE_LOCAL_POSITION.x,
  ENGINEERING_CONSOLE_LOCAL_POSITION.y,
  ENGINEERING_CONSOLE_LOCAL_POSITION.z
);
const refineryConsolePosition = new THREE.Vector3(REFINERY_TERMINAL_LOCAL_POSITION.x, REFINERY_TERMINAL_LOCAL_POSITION.y, REFINERY_TERMINAL_LOCAL_POSITION.z);
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
const handleRuntimeVisibility = createRuntimeVisibilityHandler({
  getRuntime: () => runtimeBridge,
  isActive: () => active,
  resetInputs: resetTransientState
});

const cameraNames = [
  'CÂMERA: 1ª PESSOA',
  'CÂMERA: CABINE',
  'CÂMERA: 3ª PESSOA'
];

const viewEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const cameraViewQuaternion = new THREE.Quaternion();
const forwardVector = new THREE.Vector3();

const shipFlightController = createShipFlightController({
  THREE,
  state,
  getShip: () => ship,
  getShipYaw: () => shipYaw,
  getShipPitch: () => shipPitch,
  getShipVisual: () => shipVisual,
  getEngineFlames: () => engineFlames,
  getEngineLights: () => engineLights,
  getEarthSystem: () => earthSystem,
  getLandingGearContactPoints: () => shipLandingGear?.getDeployment?.() > 0.95
    ? shipLandingGearContactPoints
    : shipEarthContactPoints,
  getLandingAutopilot: () => shipLandingAutopilot,
  getFlightQuaternion: () => flightQuaternion,
  getForwardVector: () => forwardVector,
  advanceFlightDynamics: advanceShipFlightDynamics,
  shipAudio,
  cancelLandingGuidance: reason => cancelLandingGuidance(reason),
  getElement: $
});

let launching = false;
let shipComputerSystemsRegistered = false;

function registerComputerSubsystems() {
  if (shipComputerSystemsRegistered) return;
  registerShipComputerSystems(shipComputer, {
    state,
    getShip: () => ship,
    getShipYaw: () => shipYaw?.rotation.y ?? 0,
    getPitchAngle: () => shipFlightController.pitchAngle,
    getAsteroids: () => asteroids,
    shieldSystem: shipShieldSystem,
    refinerySystem: dilithiumRefinerySystem
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
        shipManagementTerminal,
        engineeringTerminal,
        refineryTerminal,
        refinery: dilithiumRefinerySystem,
        mining: miningRuntimeSystem,
        pauseMenu: { document, state, resetInputs: resetTransientState },
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
          registerEntities: context => {
            context.entityBindings = registerGameWorldEntities(context.entityManager, {
              earthSystem,
              ship,
              characterModel,
              stationSystem,
              starshipInterior,
              externalElevator,
              asteroidSystem
            });
          },
          onStage: stage => { startupStage = stage; }
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
        gameplay: {
          isActive: () => active,
          isRendererReady: () => Boolean(renderer),
          ...createGameplayFramePhases(() => ({
            earthSystem, camera, applyEarthSurfaceRotation, ship, updatePhaserWeapon,
            characterCore, updateCharacterMovement, updateCharacterWeapon,
            updateExternalElevatorAnimation, updateElevatorInteraction,
            updatePilotInteraction, updateShipManagementInteraction, updateEngineeringConsoleInteraction, updateRefineryConsoleInteraction, updateExternalElevatorInteraction,
            updateCharacterCamera, updateFlight, updateCamera, updateShipSystems,
            setLandingBaseSystem: value => { landingBaseSystem = value; },
            updateShipLandingGuidance, THREE, shipVisual, shipEarthContactPoints,
            shipLandingGearContactPoints, forwardVector, state,
            getActivePilotHudProfile: () => activePilotHudProfile,
            orbitSystem, asteroidSystem, lightingSystem, renderer, scene, $
          }))
        }
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
    characterEquipment.initialize();
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
    applyHudLayout('character', readHudLayout('character'));

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
    window.removeEventListener('resize', resize3D);

    try { earthSystem?.dispose?.(); } catch (disposeError) {
      console.warn('Não foi possível encerrar os módulos da Terra:', disposeError);
    }
    try { shipFlightKernel?.dispose?.(); } catch (disposeError) {
      console.warn('Não foi possível liberar o kernel orbital:', disposeError);
    }
    try { gravityKernel?.dispose?.(); } catch (disposeError) {
      console.warn('Não foi possível liberar o kernel de gravidade:', disposeError);
    }

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
    shipFlightKernel = null;
    gravityKernel = null;
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
    shieldVisual,
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

  shipManagementHologram?.dispose?.();
  shipManagementHologram = createShipManagementHologram({
    parent: shipVisual,
    // Campo projetado acima do tampo da estação física no Deck 1.
    position: {
      x: SHIP_MANAGEMENT_TERMINAL_LOCAL_POSITION.x,
      y: SHIP_MANAGEMENT_TERMINAL_LOCAL_POSITION.y + 1.19,
      z: SHIP_MANAGEMENT_TERMINAL_LOCAL_POSITION.z
    },
    scale: 1.35
  });
  engineeringHologram?.dispose?.();
  engineeringHologram = createShipManagementHologram({
    parent: shipVisual,
    // Emissor holográfico dedicado acima do console físico do Deck 3.
    position: {
      x: ENGINEERING_CONSOLE_LOCAL_POSITION.x,
      y: ENGINEERING_CONSOLE_LOCAL_POSITION.y + 1.19,
      z: ENGINEERING_CONSOLE_LOCAL_POSITION.z
    },
    scale: 1.35
  });
  refineryHologram?.dispose?.();
  refineryHologram = createRefineryHologram({ parent: shipVisual, position: { x: REFINERY_TERMINAL_LOCAL_POSITION.x, y: REFINERY_TERMINAL_LOCAL_POSITION.y + 1.05, z: REFINERY_TERMINAL_LOCAL_POSITION.z }, scale: 1.15, getTelemetry: () => dilithiumRefinerySystem.snapshot() });

  characterCameraInitialized = false;
  characterInWorldFrame = false;
  characterWorldGrounded = false;
  characterWorldVelocity.set(0, 0, 0);
  externalElevatorRiding = false;
  externalElevatorActionAvailable = false;
  lastEarthSurfaceRotationY = null;
  updateDeck4Clearance();

  // Sincroniza a câmera com o personagem antes do primeiro frame renderizado.
  // Isso evita reutilizar a posição da câmera da sessão anterior ao voltar do menu.
  characterModel.group.updateWorldMatrix(true, false);
  updateCharacterCamera();
  camera.updateMatrixWorld(true);

  window.removeEventListener('resize', resize3D);
  window.addEventListener('resize', resize3D);
  return world;
}

/* REDIMENSIONAMENTO */

function resize3D() {
  if (!camera || !renderer) return;

  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  scheduleHudLayouts();
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
  const deployment = shipLandingGear?.update?.(dt) ?? 0;
  const target = shipLandingGear?.getTargetDeployment?.() ?? 0;
  const button = $('landing-btn');
  if (button && Math.abs(deployment - target) < 0.02) {
    button.classList.remove('gear-deploying');
    button.classList.toggle('gear-deployed', target > 0.5);
    button.classList.toggle('gear-retracted', target <= 0.5);
    if (target > 0.5 && (button.textContent.includes('ABRINDO') || button.textContent.includes('POUSAR'))) {
      button.textContent = '◉ TREM ABERTO · RECOLHER';
    }
    if (target <= 0.5 && button.textContent.includes('RECOLHENDO')) {
      button.textContent = '◉ TREM RECOLHIDO · POUSAR';
    }
  }
  const warpControls = $('warp-stage-controls');
  const shipComputerStatus = shipComputer.isTerminalConnected('pilot-console')
    ? shipComputer.dispatch('pilot-console', 'propulsion', 'status')
    : null;
  const propulsionState = shipComputerStatus?.ok ? shipComputerStatus.result : state;
  const warpActive = Boolean(propulsionState.warpDriveActive);
  const warpTransition = propulsionState.warpTransition || state.warpTransition || 'idle';
  const selectedWarpStage = Number(propulsionState.selectedWarpStage ?? state.warpStage ?? 5);
  const warpPanelVisible = warpActive || warpTransition !== 'idle';
  if (warpControls) warpControls.hidden = !warpPanelVisible;
  document.querySelectorAll('[data-warp-stage]').forEach(stageButton => {
    const stage = Number(stageButton.dataset.warpStage);
    const selected = warpActive && stage === selectedWarpStage;
    stageButton.classList.toggle('active', selected);
    stageButton.disabled = !warpActive;
    stageButton.setAttribute('aria-pressed', String(selected));
  });
  const moveStick = $('move-stick');
  const hasPropulsion = Number(state.fuel) > 0 || Number(state.refinedDilithium) > 0;
  if (moveStick) {
    moveStick.classList.toggle('no-propulsion', !hasPropulsion);
    moveStick.setAttribute('aria-disabled', String(!hasPropulsion));
  }
  return shipFlightController.update(dt);
}

/* CÂMERA DO PERSONAGEM — sempre dentro da nave */

function updateCharacterCamera() {
  if (!camera || !characterModel) return;
  const player = characterModel.group;
  player.updateWorldMatrix(true, false);
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
    characterCameraInitialized = true;
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

function updateShipSystems(dt) {
  const shields = shipShieldSystem.update(dt);
  if (shieldVisual) {
    shieldVisual.visible = shields.enabled && shields.shield > 0;
    shieldVisual.material.opacity = 0.025 + shields.integrity * 0.075;
  }
}

function updateCharacterMovement(dt) {
  if (!characterModel || characterCore.snapshot().mode !== 'on-foot') return;
  artificialGravityField.update(dt, state);
  if (externalElevator?.moving && externalElevatorRiding) {
    characterAnimator?.play('idle');
    characterAnimator?.update(dt);
    if (characterJumpButton) characterJumpButton.disabled = true;
    return;
  }
  if (characterInWorldFrame) {
    updateCharacterWorldPhysics(dt);
    const worldInput = characterControls.getMoveInput();
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
  const input = characterControls.getMoveInput();
  const magnitude = Math.min(1, Math.hypot(input.x, input.y));
  const deck = characterModel.group.position;
  let movedHorizontally = false;
  const stamina = characterCore.snapshot().stamina;
  const sprinting = characterControls.isSprinting() && magnitude > 0.08 && stamina > 0;
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
    if (displayedStamina <= 0 && characterControls.isSprinting()) characterControls.stopSprint();
    const staminaFill = $('character-stamina');
    const staminaLabel = $('character-stamina-value');
    if (staminaFill) staminaFill.style.width = displayedStamina + '%';
    if (staminaLabel) staminaLabel.textContent = Math.round(displayedStamina) + '%';
  }

  if (magnitude > 0.08) {
    // Movimento horizontal no referencial local da nave; a física vertical
    // é independente da translação/rotação do casco.
    // Converte a orientação mundial do personagem para o referencial da nave.
    // Assim, o joystick continua usando frente/direita do convés mesmo quando
    // a nave muda de orientação durante entrada, cruzeiro ou saída de dobra.
    const shipWorldQuaternion = shipVisual.getWorldQuaternion(new THREE.Quaternion());
    const playerWorldQuaternion = characterModel.group.getWorldQuaternion(new THREE.Quaternion());
    const deckRelativeQuaternion = shipWorldQuaternion.invert().multiply(playerWorldQuaternion);
    characterForward.set(0, 0, -1).applyQuaternion(deckRelativeQuaternion).setY(0).normalize();
    characterRight.set(1, 0, 0).applyQuaternion(deckRelativeQuaternion).setY(0).normalize();
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
  if (characterControls.consumeJump()) {
    if (characterPhysics?.jump()) {
      characterAnimator?.play('jump', { restart: true });
      characterAudio.playJump();
    }
  }

  const physicsState = characterPhysics?.update(dt, {
    position: deck,
    floorY,
    gravityField: artificialGravityField.getField([deck.x, deck.y, deck.z])
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

function updateShipManagementInteraction(dt = 0) {
  shipManagementHologram?.update(dt);
  if (!characterModel || !shipVisual || characterCore.snapshot().mode !== 'on-foot' || characterInWorldFrame || nearbyElevator) {
    shipManagementInteractionAvailable = false;
    shipManagementHologram?.setVisible(false);
    shipManagementTerminal.setPresence(false, false);
    return;
  }

  // Personagem e ponto de ancoragem compartilham o referencial local do shipVisual.
  const distanceSquared = characterModel.group.position.distanceToSquared(shipManagementTerminalPosition);
  const visible = distanceSquared <= SHIP_MANAGEMENT_TERMINAL_DISPLAY_RADIUS ** 2;
  const available = distanceSquared <= SHIP_MANAGEMENT_TERMINAL_INTERACTION_RADIUS ** 2;
  shipManagementInteractionAvailable = available;
  shipManagementHologram?.setVisible(visible);
  shipManagementTerminal.setPresence(visible, available);
  if (shipManagementTerminal.getSnapshot().open) {
    managementTelemetryAccumulator += Math.max(0, Number(dt) || 0);
    if (managementTelemetryAccumulator >= 0.18) {
      managementTelemetryAccumulator = 0;
      shipManagementTerminal.refresh();
    }
  } else {
    managementTelemetryAccumulator = 0;
  }
}

function updateEngineeringConsoleInteraction(dt = 0) {
  engineeringHologram?.update(dt);
  const previousAvailable = engineeringInteractionAvailable;
  const previousActive = engineeringConsoleActive;
  const validContext = Boolean(characterModel && shipVisual &&
    characterCore.snapshot().mode === 'on-foot' && !characterInWorldFrame &&
    !nearbyElevator && activeDeckIndex === 2);

  if (!validContext) {
    engineeringInteractionAvailable = false;
    engineeringHologram?.setVisible(false);
    engineeringRenderer.setPresence(false, false);
    engineeringTerminal.setPresence(false, false);
    if ((previousAvailable || previousActive) && !nearbyElevator) {
      const button = $('character-action-btn');
      if (button) { button.disabled = true; button.textContent = 'AÇÃO'; button.classList.remove('available'); }
      characterCore.setInteractionTarget(null);
      updateCharacterHUD();
      updatePilotInteraction();
    }
    return;
  }

  const distanceSquared = characterModel.group.position.distanceToSquared(engineeringConsolePosition);
  const visible = distanceSquared <= ENGINEERING_CONSOLE_DISPLAY_RADIUS ** 2;
  const available = distanceSquared <= ENGINEERING_CONSOLE_INTERACTION_RADIUS ** 2;
  engineeringInteractionAvailable = available;
  engineeringHologram?.setVisible(visible);
  engineeringRenderer.setPresence(visible, available);
  engineeringTerminal.setPresence(visible, available);
  if (engineeringConsoleActive) {
    engineeringTelemetryAccumulator += Math.max(0, Number(dt) || 0);
    if (engineeringTelemetryAccumulator >= 0.18) {
      engineeringTelemetryAccumulator = 0;
      const response = engineeringTerminal.dispatch('engineering', 'status');
      if (response.ok) engineeringRenderer.update(response.result);
    }
  }

  if (available || engineeringConsoleActive) {
    const button = $('character-action-btn');
    if (button) {
      button.disabled = false;
      button.textContent = engineeringConsoleActive ? '◎ DESCONECTAR ENGENHARIA' : '◎ ENGENHARIA';
      button.classList.add('available');
    }
    characterCore.setInteractionTarget(engineeringConsoleActive ? 'CONSOLE DE ENGENHARIA CONECTADO' : 'CONSOLE DE ENGENHARIA');
    if (previousAvailable !== available || previousActive !== engineeringConsoleActive) updateCharacterHUD();
  } else if (previousAvailable || previousActive) {
    const button = $('character-action-btn');
    if (button) { button.disabled = true; button.textContent = 'AÇÃO'; button.classList.remove('available'); }
    characterCore.setInteractionTarget(null);
    updateCharacterHUD();
    updatePilotInteraction();
  }
}

function toggleEngineeringConsole() {
  if (engineeringConsoleActive) { engineeringTerminal.close(); return; }
  if (!engineeringInteractionAvailable || !engineeringTerminal.open('ENGENHEIRO')) {
    toast('Aproxime-se do console de Engenharia no Deck 3.');
  }
}

function updateRefineryConsoleInteraction(dt = 0) {
 refineryHologram?.update(dt);const pa=refineryInteractionAvailable,pc=refineryConsoleActive;
 const valid=Boolean(characterModel&&shipVisual&&characterCore.snapshot().mode==='on-foot'&&!characterInWorldFrame&&!nearbyElevator&&activeDeckIndex===2);
 if(!valid){refineryInteractionAvailable=false;refineryHologram?.setVisible(false);refineryTerminal?.setPresence(false,false);if((pa||pc)&&!nearbyElevator){const b=$('character-action-btn');if(b){b.disabled=true;b.textContent='AÇÃO';b.classList.remove('available');}characterCore.setInteractionTarget(null);updateCharacterHUD();updatePilotInteraction();}return;}
 const d=characterModel.group.position.distanceToSquared(refineryConsolePosition),visible=d<=REFINERY_TERMINAL_DISPLAY_RADIUS**2,available=d<=REFINERY_TERMINAL_INTERACTION_RADIUS**2;
 refineryInteractionAvailable=available;refineryHologram?.setVisible(visible);refineryTerminal?.setPresence(visible,available);
 if(refineryConsoleActive){refineryTelemetryAccumulator+=Math.max(0,Number(dt)||0);if(refineryTelemetryAccumulator>=.18){refineryTelemetryAccumulator=0;refineryTerminal?.refresh();}}else refineryTelemetryAccumulator=0;
 if(available||refineryConsoleActive){const b=$('character-action-btn');if(b){b.disabled=false;b.textContent=refineryConsoleActive?'◎ FECHAR REFINARIA':'◎ REFINARIA';b.classList.add('available');}characterCore.setInteractionTarget(refineryConsoleActive?'TERMINAL DA REFINARIA CONECTADO':'TERMINAL DA REFINARIA');if(pa!==available||pc!==refineryConsoleActive)updateCharacterHUD();}
 else if(pa||pc){const b=$('character-action-btn');if(b){b.disabled=true;b.textContent='AÇÃO';b.classList.remove('available');}characterCore.setInteractionTarget(null);updateCharacterHUD();updatePilotInteraction();}
}
function toggleRefineryConsole(){if(refineryConsoleActive){refineryTerminal?.close();return;}if(!refineryInteractionAvailable||!refineryTerminal?.open('ENGENHEIRO DE RECURSOS'))toast('Aproxime-se do terminal da Refinaria no Deck 3.');}

function updatePilotInteraction() {
  if (refineryInteractionAvailable || refineryConsoleActive) return;
  if (!characterModel || !shipVisual || characterCore.snapshot().mode !== 'on-foot') return;
  if (engineeringInteractionAvailable || engineeringConsoleActive) return;

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
  ['hud', 'warp-drive-display', 'flight-controls', 'leave-pilot-btn'].forEach(id => {
    $(id)?.classList.toggle('hidden', !activePilot);
  });
  applyHudLayout(activePilot ? 'pilot' : 'character', readHudLayout(activePilot ? 'pilot' : 'character'));
}

function enterPilotMode() {
  if (!pilotInteractionAvailable || characterCore.snapshot().mode !== 'on-foot') {
    toast('Aproxime-se do ponto de pilotagem na ponte.');
    return;
  }

  if (!shipComputer.connectTerminal('pilot-console', 'PILOTO')) {
    toast('O Ship Computer não está disponível para assumir a pilotagem.');
    return;
  }
  if (!attachCharacterToPilotConsole(characterModel, shipVisual)) {
    shipComputer.disconnectTerminal('pilot-console');
    return;
  }

  characterControls.reset();
  characterCore.enterShipSeat();
  pilotInteractionAvailable = false;
  state.camera = 0;
  state.view.x = 0;
  state.view.y = 0;
  state.aim = { x: 0, y: 0 };
  setPilotInterface(true);
  toast('Comando da Aurora-7 assumido.');
}

function disconnectPilotTerminal() {
  return shipComputer.disconnectTerminal('pilot-console');
}

function shutdownWarpDrive() {
  // A saída da dobra é independente da saída do assento e da desconexão.
  // O ciclo de voo executa a transição suave até a velocidade convencional.
  state.warpDriveButton = false;
  state.throttle = false;
  state.braking = false;
}

function leavePilotSeat() {
  if (characterCore.snapshot().mode !== 'ship-control') return false;
  cancelLandingGuidance('pilot-disconnected');
  characterYaw = returnCharacterToDeck(characterModel, shipVisual, scene);
  characterPitch = 0;
  characterCore.leaveShipSeat();
  characterControls.reset();
  state.move.x = 0;
  state.move.y = 0;
  state.throttle = false;
  state.braking = false;

  const flightStick = $('move-stick')?.querySelector('.knob');
  if (flightStick) flightStick.style.transform = 'translate(0,0)';
  setPilotInterface(false);
  updateCharacterHUD();
  updatePilotInteraction();
  return true;
}

function exitPilotMode({ disconnectTerminal = true, shutdownWarp = false } = {}) {
  if (!leavePilotSeat()) return false;
  if (shutdownWarp) shutdownWarpDrive();
  if (disconnectTerminal) disconnectPilotTerminal();
  toast('Você deixou o comando da nave.');
  return true;
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

/* JOYSTICK */

function bindStick(id, key) {
  const element = $(id);
  if (!element) return;

  const knob = element.querySelector('.knob');
  let pointer = null;
  const hasPropulsion = () => Number(state.fuel) > 0 || Number(state.refinedDilithium) > 0;
  const reset = () => {
    state[key].x = 0;
    state[key].y = 0;
    if (knob) knob.style.transform = 'translate(-50%,-50%)';
    element.classList.remove('is-active');
  };

  const moveStick = event => {
    const rect = element.getBoundingClientRect();
    const max = Math.max(1, rect.width * 0.34);
    let x = event.clientX - rect.left - rect.width / 2;
    let y = event.clientY - rect.top - rect.height / 2;
    const length = Math.hypot(x, y);
    if (length > max) { x *= max / length; y *= max / length; }

    if (key === 'move' && !hasPropulsion()) {
      reset();
      element.classList.add('no-propulsion');
      return;
    }
    element.classList.remove('no-propulsion');
    state[key].x = THREE.MathUtils.clamp(x / max, -1, 1);
    state[key].y = THREE.MathUtils.clamp(y / max, -1, 1);
    if (knob) knob.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
  };

  element.addEventListener('pointerdown', event => {
    if (pointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (key === 'move' && !hasPropulsion()) {
      element.classList.add('no-propulsion');
      return;
    }
    event.preventDefault();
    pointer = event.pointerId;
    element.classList.add('is-active');
    try { element.setPointerCapture(pointer); } catch {}
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
    reset();
  };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => element.addEventListener(type, end));
  window.addEventListener('blur', () => {
    pointer = null;
    reset();
  });
}

bindStick('move-stick', 'move');

const characterControls = registerCharacterControls({
  document,
  window,
  isOnFoot: () => characterCore.snapshot().mode === 'on-foot' && !shipManagementTerminal.getSnapshot().open,
  isGrounded: () => Boolean(characterPhysics?.grounded),
  onFirePhaser: firePhaser,
  onToggleAim: () => {
    if (!isPhaserEquipped() || characterCore.snapshot().mode !== 'on-foot') {
      toast('Equipe o Phaser para usar a mira.');
      return;
    }
    const aiming = characterWeaponController?.toggleAiming() ?? false;
    toast(aiming ? 'Mira ativada.' : 'Arma abaixada.');
  },
  onAimLook: (dx, dy) => {
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
  }
});
const characterJumpButton = characterControls.jumpButton;
const characterSprintButton = characterControls.sprintButton;
const characterAnimationButton = $('character-animation-btn');

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

$('character-action-btn')?.addEventListener('click', () => {
  if (externalElevatorActionAvailable) activateExternalElevator();
  else if (refineryInteractionAvailable || refineryConsoleActive) toggleRefineryConsole();
  else if (engineeringInteractionAvailable || engineeringConsoleActive) toggleEngineeringConsole();
  else enterPilotMode();
});
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('inventory-modal')?.classList.contains('hidden')) { closeInventory(); return; }
  if (event.key === 'Escape' && refineryConsoleActive) { refineryTerminal?.close(); return; }
  if (event.key === 'Escape' && shipManagementTerminal.getSnapshot().open) {
    shipManagementTerminal.close();
  }
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
    const action = item.definitionId === DILITHIUM_ORE_ITEM_ID
      ? 'ENVIAR À REFINARIA'
      : 'TOQUE PARA EQUIPAR';
    return `<button class="inventory-cell inventory-item-button" type="button" data-item-instance="${escapeHtml(item.instanceId)}">
      <span>${name}${quantity}</span><small>${category} · ${action}</small>
    </button>`;
  }).join('');

  const overflowGrid = $('inventory-overflow-grid');
  if (overflowGrid) {
    overflowGrid.innerHTML = overflowItems.map(item => {
      const name = escapeHtml(item.name || item.itemId || item.definitionId);
      const quantity = item.quantity > 1 ? ` ×${item.quantity}` : '';
      const equipable = ['head', 'torso', 'hands', 'legs', 'feet', 'back', 'weapon'].includes(item.slot);
      const pending = pendingInventoryEquipId === item.instanceId;
      const action = item.definitionId === DILITHIUM_ORE_ITEM_ID
        ? 'ENVIAR À REFINARIA'
        : (equipable ? (pending ? 'EQUIPAR AGORA' : 'TOQUE PARA SELECIONAR') : 'TOQUE PARA RESTAURAR');
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
  const target = event.target.closest('[data-item-instance]'); if (!target) return;
  const item = characterEquipment.snapshot().items.find(entry => entry.instanceId === target.dataset.itemInstance);
  if (item?.definitionId === DILITHIUM_ORE_ITEM_ID) {
    if (!dilithiumRefinerySystem.canReceiveRawOre(item.quantity).accepted) { toast('Compartimento de minério bruto cheio.'); return; }
    const removed = characterEquipment.removeInstance(item.instanceId); if (!removed.ok) { toast(removed.reason); return; }
    const received = dilithiumRefinerySystem.receiveRawOre(removed.item.quantity);
    if (!received.accepted) { characterEquipment.restoreInstance(removed.item); toast('Transferência cancelada: a Refinaria não aceitou o minério.'); return; }
    document.querySelector('[data-refinery-receiving-slot]')?.classList.remove('is-receiving'); const receiveHint = document.querySelector('[data-refinery-receive-hint]'); if (receiveHint) receiveHint.textContent = 'MINÉRIO RECEBIDO E ARMAZENADO'; save(); refineryTerminal?.refresh(); renderInventory(); toast('Minério de dilítio transferido para a Refinaria.'); return;
  }
  const result = characterEquipment.equip(target.dataset.itemInstance); pendingInventoryEquipId = null;
  if (!result.ok) toast(result.reason); else { save(); toast(result.item.name + ' equipado no personagem.'); }
  renderInventory();
});
$('inventory-overflow-grid')?.addEventListener('click', event => {
  const target = event.target.closest('[data-overflow-instance-id]');
  if (!target) return;
  const instanceId = target.dataset.overflowInstanceId;
  const item = characterEquipment.snapshot().overflowItems.find(entry => entry.instanceId === instanceId);
  if (!item) return;
  if (item.definitionId === DILITHIUM_ORE_ITEM_ID) {
    if (!dilithiumRefinerySystem.canReceiveRawOre(item.quantity).accepted) { toast('Compartimento de minério bruto cheio.'); return; }
    const removed = characterEquipment.removeInstance(instanceId); if (!removed.ok) { toast(removed.reason); return; }
    const received = dilithiumRefinerySystem.receiveRawOre(removed.item.quantity);
    if (!received.accepted) { characterEquipment.restoreInstance(removed.item); toast('Transferência cancelada.'); return; }
    document.querySelector('[data-refinery-receiving-slot]')?.classList.remove('is-receiving'); const receiveHint = document.querySelector('[data-refinery-receive-hint]'); if (receiveHint) receiveHint.textContent = 'MINÉRIO RECEBIDO E ARMAZENADO'; save(); refineryTerminal?.refresh(); renderInventory(); toast('Minério de dilítio transferido para a Refinaria.'); return;
  }
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
  handleRuntimeVisibility(document.hidden);
});

registerAimControls({ document, THREE, state });
const instrumentBindings = [
  ['hull', 'hull-bar', 100], ['shield', 'shield-bar', 100],
  ['fuel', 'fuel-bar', 100], ['speed', 'speed-bar', 100]
];
const updateInstrumentBars = () => instrumentBindings.forEach(([valueId, barId, max]) => {
  const value = Number($(valueId)?.textContent?.replace(',', '.')) || 0;
  const fill = $(barId);
  if (!fill) return;
  const ratio = Math.max(0, Math.min(100, value / max * 100));
  fill.style.width = ratio + '%';
  fill.style.filter = ratio < 25 ? 'saturate(.65) brightness(.8)' : 'none';
});
const instrumentObserver = new MutationObserver(updateInstrumentBars);
instrumentBindings.forEach(([valueId]) => {
  const value = $(valueId);
  if (value) instrumentObserver.observe(value, { childList:true, characterData:true, subtree:true });
});
updateInstrumentBars();
registerHeldFlightControls({
  document, window, state,
  dispatchPropulsionCommand: payload => {
    const response = shipComputer.dispatch('pilot-console', 'propulsion', 'setPilotInput', payload);
    return response.ok ? response.result : { accepted: false, reason: response.reason };
  },
  onWarpRejected: reason => toast(reason === 'dilithium-unavailable'
    ? 'Dilítio refinado insuficiente para iniciar a dobra.'
    : 'O Ship Computer recusou o comando de dobra.')
});
document.querySelectorAll('[data-warp-stage]').forEach(button => {
  button.addEventListener('click', () => {
    const stage = Number(button.dataset.warpStage);
    const response = shipComputer.dispatch('pilot-console', 'propulsion', 'setWarpStage', { stage });
    if (!response.ok || !response.result?.accepted) toast('Não foi possível selecionar esse estágio de dobra.');
  });
});
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

  const gearTarget = shipLandingGear?.getTargetDeployment?.() ?? 0;
  const gearCurrent = shipLandingGear?.getDeployment?.() ?? 0;
  if (shipLandingAutopilot?.snapshot?.().active) {
    cancelLandingGuidance('standby');
    shipAudio.playConsole();
    if ($('landing-status')) $('landing-status').textContent = 'Orientação cancelada. O trem permanece aberto até novo comando.';
    toast('Guia de pouso cancelada.');
    return;
  }

  if (gearTarget > 0.5 && selectedLandingSiteId && gearCurrent < 0.98) {
    toast('Aguarde o trem de pouso travar na posição aberta.');
    return;
  }

  if (gearTarget > 0.5 && !selectedLandingSiteId) {
    shipLandingGear?.setDeployment?.(0);
    $('landing-modal')?.classList.add('hidden');
    $('landing-modal')?.setAttribute('aria-hidden', 'true');
    const button = $('landing-btn');
    if (button) {
      button.textContent = '◉ TREM RECOLHENDO';
      button.classList.add('gear-deploying');
      button.classList.remove('gear-deployed');
    }
    shipAudio.playConsole();
    toast('Trem de pouso recolhendo.');
    return;
  }

  if (gearTarget <= 0.5) {
    shipLandingGear?.setDeployment?.(1);
    const button = $('landing-btn');
    if (button) {
      button.textContent = '◉ TREM ABRINDO';
      button.classList.add('gear-deploying');
      button.classList.remove('gear-retracted');
    }
    $('landing-modal')?.classList.remove('hidden');
    $('landing-modal')?.setAttribute('aria-hidden', 'false');
    const status = $('landing-status');
    if (status) status.textContent = 'Trem de pouso em abertura. Aguarde o travamento antes de iniciar a aproximação.';
    shipAudio.playConsole();
    toast('Trem de pouso acionado: abrindo.');
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
    $('landing-btn').textContent = '✕ CANCELAR GUIA · TREM ABERTO';
    $('landing-btn').classList.add('gear-deployed');
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
  if (button) {
    button.textContent = '◎ ATIVAR GUIA · TREM ABERTO';
    button.classList.add('gear-deployed');
    button.classList.remove('gear-deploying','gear-retracted');
  }
  const status = $('landing-status');
  if (status) status.textContent = 'Destino marcado: Salar de Uyuni · UY04. Ative a guia quando estiver pronto. A orientação calcula a aproximação, mas ainda não comanda a propulsão.';
  closeLandingPanel();
  toast('Destino UY04 marcado. Telemetria pronta para conexão.');
});

/* CÂMERAS */

registerCameraCycleControl({ document, state, cameraNames });

const miningRuntimeSystem = createMiningRuntimeSystem({
  state,
  isActive: () => active,
  getAsteroids: () => asteroids,
  getShip: () => ship,
  getAsteroidSystem: () => asteroidSystem,
  setAsteroids: value => { asteroids = value; },
  save,
  updateWallet,
  shipAudio,
  toast,
  receiveDilithiumOre: quantity => {
    const capacity = dilithiumRefinerySystem.canReceiveRawOre(quantity);
    const amount = Math.min(Number(quantity) || 0, Number(capacity.available) || 0);
    if (amount <= 0) return { added: 0 };
    const received = dilithiumRefinerySystem.receiveRawOre(amount);
    return { added: received.accepted ? received.received : 0 };
  }
});

registerGameplayActions({
  document,
  THREE,
  getElement: $,
  state,
  isActive: () => active,
  mine: () => miningRuntimeSystem.mine(),
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

/* Editor de HUD com quatro perfis independentes para a gameplay do piloto. */
const characterHudEditor = $('character-hud-editor');
const characterHudEditable = [...document.querySelectorAll('#character-hud [data-hud-editable]')];
characterHudEditable.forEach(element => { element.dataset.hudScope = 'character'; });
const pilotHudEditable = [...document.querySelectorAll('[data-hud-scope="pilot"][data-hud-editable]')]
  .filter(element => Boolean(element.dataset.hudProfile));
const allHudEditable = [...characterHudEditable, ...pilotHudEditable];
const pilotHudProfiles = createPilotHudProfileStore(state.settings);
let activePilotHudProfile = 'flight';
let hudEditorPilotProfile = 'flight';
let characterHudEditing = false;
let hudEditorTarget = 'character';
let hudEditorBeforeEdit = null;
let hudEditorWorkingLayouts = null;
let hudEditorWorkingButtonSize = null;
let hudEditorWorkingButtonSizes = null;
let hudEditorChangedButtonSizes = new Set();
let characterHudDrag = null;

function hudLayoutKey(scope) {
  return scope === 'pilot' ? 'pilotHudProfiles' : 'characterHudLayout';
}

function getPilotHudElements(profile = hudEditorPilotProfile) {
  return pilotHudEditable.filter(element =>
    element.dataset.hudProfile === 'all' || element.dataset.hudProfile.split(/\s+/).includes(profile)
  );
}

function readHudLayout(scope, profile = hudEditorPilotProfile) {
  if (scope === 'character' && hudEditorWorkingLayouts?.character !== undefined) {
    return cloneHudData(hudEditorWorkingLayouts.character);
  }
  if (scope === 'pilot') {
    return hudEditorWorkingLayouts?.pilot?.[profile] !== undefined
      ? cloneHudData(hudEditorWorkingLayouts.pilot[profile])
      : pilotHudProfiles.getLayout(profile);
  }
  const key = hudLayoutKey(scope);
  return state.settings?.[key] && typeof state.settings[key] === 'object'
    ? cloneHudData(state.settings[key])
    : {};
}

function applyHudLayout(scope, layout = readHudLayout(scope), profile = hudEditorPilotProfile) {
  const elements = scope === 'pilot' ? getPilotHudElements(profile) : characterHudEditable;
  elements.forEach(element => {
    const saved = layout[element.dataset.hudEditable];
    if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) {
      ['position', 'left', 'top', 'right', 'bottom', 'transform'].forEach(prop => element.style.removeProperty(prop));
      return;
    }
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      ['position', 'left', 'top', 'right', 'bottom', 'transform'].forEach(prop => element.style.removeProperty(prop));
      return;
    }
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

function captureHudLayout(scope, profile = hudEditorPilotProfile) {
  const elements = scope === 'pilot' ? getPilotHudElements(profile) : characterHudEditable;
  const layout = {};
  elements.forEach(element => {
    const rect = element.getBoundingClientRect();
    layout[element.dataset.hudEditable] = {
      x: Math.max(0, Math.min(1, rect.left / Math.max(1, window.innerWidth - rect.width))),
      y: Math.max(0, Math.min(1, rect.top / Math.max(1, window.innerHeight - rect.height)))
    };
  });
  return layout;
}

function readPilotHudButtonSize(profile = hudEditorPilotProfile) {
  const profileSizes = state.settings?.pilotHudProfileButtonSizes;
  const saved = (profileSizes
    ? profileSizes[profile]
    : (['flight', 'combat'].includes(profile) ? state.settings?.pilotHudButtonSize : null)) || {};
  return {
    width: Number.isFinite(saved.width) ? Math.max(82, Math.min(180, saved.width)) : 112,
    height: Number.isFinite(saved.height) ? Math.max(40, Math.min(88, saved.height)) : 52
  };
}

function applyPilotHudButtonSize(size = readPilotHudButtonSize(), applyToButtons = true, profile = hudEditorPilotProfile) {
  if (applyToButtons) pilotHudEditable
    .filter(element => element.dataset.hudProfile.split(/\s+/).includes(profile))
    .flatMap(element => [...element.querySelectorAll('[data-pilot-size-button]')])
    .forEach(button => {
      button.style.width = `${size.width}px`;
      button.style.minWidth = `${size.width}px`;
      button.style.height = `${size.height}px`;
      button.style.minHeight = `${size.height}px`;
    });
  if (profile !== hudEditorPilotProfile) return;
  const width = $('pilot-hud-button-width');
  const height = $('pilot-hud-button-height');
  const widthValue = $('pilot-hud-button-width-value');
  const heightValue = $('pilot-hud-button-height-value');
  if (width) width.value = String(size.width);
  if (height) height.value = String(size.height);
  if (widthValue) widthValue.textContent = `${size.width} px`;
  if (heightValue) heightValue.textContent = `${size.height} px`;
}

function clearPilotHudButtonSize(profile = hudEditorPilotProfile) {
  pilotHudEditable
    .filter(element => element.dataset.hudProfile.split(/\s+/).includes(profile))
    .flatMap(element => [...element.querySelectorAll('[data-pilot-size-button]')])
    .forEach(button => {
      ['width', 'min-width', 'height', 'min-height'].forEach(prop => button.style.removeProperty(prop));
    });
  if (profile === hudEditorPilotProfile) {
    applyPilotHudButtonSize({ width: 112, height: 52 }, false, profile);
  }
}

function applyHudProfileVisibility(profile) {
  document.querySelectorAll('[data-hud-profile]').forEach(element => {
    const assigned = element.dataset.hudProfile;
    const visible = assigned === 'all' || (profile !== null && assigned.split(/\s+/).includes(profile));
    element.classList.toggle('hud-profile-hidden', !visible);
  });
}

function updateHudProfileButtons(selector, attribute, selectedProfile) {
  document.querySelectorAll(`${selector} [${attribute}]`).forEach(button => {
    const selected = button.getAttribute(attribute) === selectedProfile;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function setActivePilotHudProfile(profile) {
  if (!PILOT_HUD_PROFILES.some(item => item.id === profile)) return false;
  activePilotHudProfile = profile;
  if (profile !== 'navigation') $('navigation-full-panel')?.classList.add('hidden');
  applyHudProfileVisibility(profile);
  updateHudProfileButtons('#pilot-hud-profile-selector', 'data-hud-gameplay-profile', profile);
  applyHudLayout('pilot', pilotHudProfiles.getLayout(profile), profile);
  return true;
}

function updateHudEditorButtonSizeVisibility() {
  const hasResizableButtons = getPilotHudElements(hudEditorPilotProfile)
    .some(element => element.querySelector('[data-pilot-size-button]'));
  $('pilot-hud-size-controls')?.classList.toggle(
    'hidden',
    hudEditorTarget !== 'pilot' || !hasResizableButtons
  );
}

function setHudEditorPilotProfile(profile) {
  if (!PILOT_HUD_PROFILES.some(item => item.id === profile)) return;
  if (characterHudEditing && hudEditorTarget === 'pilot' && hudEditorWorkingLayouts) {
    hudEditorWorkingLayouts.pilot[hudEditorPilotProfile] = captureHudLayout('pilot', hudEditorPilotProfile);
  }
  if (hudEditorWorkingButtonSizes) hudEditorWorkingButtonSizes[hudEditorPilotProfile] = { ...hudEditorWorkingButtonSize };
  hudEditorPilotProfile = profile;
  if (profile !== 'navigation') $('navigation-full-panel')?.classList.add('hidden');
  hudEditorWorkingButtonSize = hudEditorWorkingButtonSizes?.[profile]
    ? { ...hudEditorWorkingButtonSizes[profile] }
    : readPilotHudButtonSize(profile);
  updateHudProfileButtons('#pilot-hud-profile-tabs', 'data-hud-editor-profile', profile);
  if (characterHudEditing && hudEditorTarget === 'pilot') {
    const label = PILOT_HUD_PROFILES.find(item => item.id === profile)?.label || 'Voo';
    $('hud-editor-hint').textContent = `Editando o perfil ${label}. Posições e dimensões são salvas separadamente.`;
  }
  updateHudEditorButtonSizeVisibility();
  applyPilotHudButtonSize(hudEditorWorkingButtonSize, true, profile);
  if (characterHudEditing && hudEditorTarget === 'pilot') {
    applyHudProfileVisibility(profile);
    pilotHudEditable.forEach(element => element.classList.toggle(
      'hud-editable-active',
      element.dataset.hudProfile === 'all' || element.dataset.hudProfile.split(/\s+/).includes(profile)
    ));
    applyHudLayout('pilot', readHudLayout('pilot', profile), profile);
  }
}

function setHudEditorTarget(scope) {
  if (!['character', 'pilot'].includes(scope)) return;
  if (characterHudEditing && hudEditorWorkingLayouts) {
    if (hudEditorTarget === 'character' && scope !== 'character') {
      hudEditorWorkingLayouts.character = captureHudLayout('character');
    } else if (hudEditorTarget === 'pilot' && scope !== 'pilot') {
      hudEditorWorkingLayouts.pilot[hudEditorPilotProfile] = captureHudLayout('pilot', hudEditorPilotProfile);
    }
  }
  hudEditorTarget = scope;
  const characterSelected = scope === 'character';
  if (characterSelected) $('navigation-full-panel')?.classList.add('hidden');
  $('hud-editor-character-tab')?.classList.toggle('active', characterSelected);
  $('hud-editor-pilot-tab')?.classList.toggle('active', !characterSelected);
  $('pilot-hud-profile-tabs')?.classList.toggle('hidden', characterSelected);
  updateHudProfileButtons('#pilot-hud-profile-tabs', 'data-hud-editor-profile', hudEditorPilotProfile);
  updateHudEditorButtonSizeVisibility();
  $('hud-editor-hint').textContent = characterSelected
    ? 'Arraste os elementos do HUD do personagem para ajustar suas posições.'
    : `Editando o perfil ${PILOT_HUD_PROFILES.find(item => item.id === hudEditorPilotProfile)?.label || 'Voo'}. Cada perfil mantém posições e dimensões próprias.`;
  const selectedElements = characterSelected ? characterHudEditable : getPilotHudElements();
  const unselectedElements = characterSelected ? pilotHudEditable : characterHudEditable;
  unselectedElements.forEach(element => element.classList.remove('hud-editable-active'));
  selectedElements.forEach(element => element.classList.add('hud-editable-active'));
  ['character-hud', 'hud', 'flight-controls', 'leave-pilot-btn'].forEach(id => $(id)?.classList.remove('hud-editor-preview'));
  $('character-hud')?.classList.toggle('hud-profile-hidden', !characterSelected);
  ['hud', 'flight-controls', 'leave-pilot-btn'].forEach(id =>
    $(id)?.classList.toggle('hud-profile-hidden', characterSelected)
  );
  applyHudProfileVisibility(characterSelected ? null : hudEditorPilotProfile);
  if (characterSelected) {
    $('character-hud')?.classList.add('hud-editor-preview');
  } else {
    ['hud', 'flight-controls', 'leave-pilot-btn'].forEach(id => $(id)?.classList.add('hud-editor-preview'));
    applyPilotHudButtonSize(hudEditorWorkingButtonSize || readPilotHudButtonSize(), true, hudEditorPilotProfile);
  }
  applyHudLayout(scope, readHudLayout(scope), hudEditorPilotProfile);
}

function scheduleHudLayouts() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const gameScreen = $('game-screen');
    if (!gameScreen || gameScreen.classList.contains('hidden')) return;
    if (characterHudEditable.every(element => element.getBoundingClientRect().width > 0)) {
      applyHudLayout('character', readHudLayout('character'));
    }
    if (getPilotHudElements(activePilotHudProfile).some(element => element.getBoundingClientRect().width > 0)) {
      applyHudLayout('pilot', pilotHudProfiles.getLayout(activePilotHudProfile), activePilotHudProfile);
    }
  }));
}

function finishCharacterHudEditing({ saveChanges = false, reset = false } = {}) {
  if (!characterHudEditing) return;
  state.settings ||= {};
  if (reset) {
    if (hudEditorTarget === 'pilot') {
      hudEditorWorkingLayouts.pilot[hudEditorPilotProfile] = {};
      applyHudLayout('pilot', {}, hudEditorPilotProfile);
      hudEditorWorkingButtonSize = { width: 112, height: 52 };
      if (hudEditorWorkingButtonSizes) hudEditorWorkingButtonSizes[hudEditorPilotProfile] = { ...hudEditorWorkingButtonSize };
      hudEditorChangedButtonSizes.add(hudEditorPilotProfile);
      clearPilotHudButtonSize(hudEditorPilotProfile);
    } else {
      hudEditorWorkingLayouts.character = {};
      applyHudLayout('character', {});
    }
    $('hud-editor-hint').textContent = 'Perfil restaurado ao padrão. Toque em SALVAR para confirmar.';
  } else if (saveChanges) {
    if (hudEditorTarget === 'pilot') {
      hudEditorWorkingLayouts.pilot[hudEditorPilotProfile] = captureHudLayout('pilot', hudEditorPilotProfile);
    } else {
      hudEditorWorkingLayouts.character = captureHudLayout('character');
    }
    state.settings.characterHudLayout = hudEditorWorkingLayouts.character;
    for (const profile of PILOT_HUD_PROFILES) {
      pilotHudProfiles.setLayout(profile.id, hudEditorWorkingLayouts.pilot[profile.id] || {});
    }
    if (hudEditorTarget === 'pilot') {
      hudEditorWorkingButtonSize = {
        width: Number($('pilot-hud-button-width')?.value) || 112,
        height: Number($('pilot-hud-button-height')?.value) || 52
      };
      hudEditorWorkingButtonSizes[hudEditorPilotProfile] = { ...hudEditorWorkingButtonSize };
    }
    state.settings.pilotHudProfileButtonSizes ||= {};
    for (const profile of PILOT_HUD_PROFILES) {
      const size = hudEditorWorkingButtonSizes[profile.id] || { width: 112, height: 52 };
      if (hudEditorChangedButtonSizes.has(profile.id) || hudEditorBeforeEdit.hasCustomPilotButtonSizes[profile.id]) {
        state.settings.pilotHudProfileButtonSizes[profile.id] = { ...size };
      } else {
        delete state.settings.pilotHudProfileButtonSizes[profile.id];
      }
      applyPilotHudButtonSize(size, true, profile.id);
    }
    if (state.settings.pilotHudProfileButtonSizes.flight) {
      state.settings.pilotHudButtonSize = { ...state.settings.pilotHudProfileButtonSizes.flight };
    } else {
      delete state.settings.pilotHudButtonSize;
    }
    if (!Object.keys(state.settings.pilotHudProfileButtonSizes).length) delete state.settings.pilotHudProfileButtonSizes;
    save();
    hudEditorWorkingButtonSize = { ...hudEditorWorkingButtonSizes[hudEditorPilotProfile] };
  } else {
    applyHudLayout('character', hudEditorBeforeEdit.character);
    for (const profile of PILOT_HUD_PROFILES) {
      applyHudLayout('pilot', hudEditorBeforeEdit.pilotProfiles[profile.id] || {}, profile.id);
    }
    for (const profile of PILOT_HUD_PROFILES) {
      if (hudEditorBeforeEdit.hasCustomPilotButtonSizes[profile.id]) {
        applyPilotHudButtonSize(hudEditorBeforeEdit.pilotButtonSizes[profile.id], true, profile.id);
      } else {
        clearPilotHudButtonSize(profile.id);
      }
    }
    hudEditorWorkingButtonSize = null;
  }

  if (reset) return;
  characterHudEditing = false;
  characterHudDrag = null;
  allHudEditable.forEach(element => element.classList.remove('hud-editable-active'));
  ['character-hud', 'hud', 'flight-controls', 'leave-pilot-btn'].forEach(id => $(id)?.classList.remove('hud-editor-preview'));
  ['character-hud', 'hud', 'flight-controls', 'leave-pilot-btn'].forEach(id =>
    $(id)?.classList.remove('hud-profile-hidden')
  );
  characterHudEditor?.classList.add('hidden');
  characterHudEditor?.setAttribute('aria-hidden', 'true');
  hudEditorWorkingLayouts = null;
  applyHudProfileVisibility(activePilotHudProfile);
  applyHudLayout('pilot', pilotHudProfiles.getLayout(activePilotHudProfile), activePilotHudProfile);
  hudEditorWorkingButtonSizes = null;
  hudEditorChangedButtonSizes = new Set();
}

function startCharacterHudEditing() {
  if (characterHudEditing) return;
  $('navigation-full-panel')?.classList.add('hidden');
  characterHudEditing = true;
  hudEditorTarget = characterCore.snapshot().mode === 'ship-control' ? 'pilot' : 'character';
  hudEditorPilotProfile = activePilotHudProfile;
  hudEditorBeforeEdit = {
    character: readHudLayout('character'),
    pilotProfiles: pilotHudProfiles.snapshot(),
    pilotButtonSizes: Object.fromEntries(PILOT_HUD_PROFILES.map(profile => [profile.id, readPilotHudButtonSize(profile.id)])),
    hasCustomPilotButtonSizes: Object.fromEntries(PILOT_HUD_PROFILES.map(profile => [
      profile.id,
      Boolean(state.settings?.pilotHudProfileButtonSizes
        ? state.settings.pilotHudProfileButtonSizes[profile.id]
        : (['flight', 'combat'].includes(profile.id) && state.settings?.pilotHudButtonSize))
    ]))
  };
  hudEditorWorkingLayouts = {
    character: cloneHudData(hudEditorBeforeEdit.character),
    pilot: cloneHudData(hudEditorBeforeEdit.pilotProfiles)
  };
  hudEditorWorkingButtonSizes = cloneHudData(hudEditorBeforeEdit.pilotButtonSizes);
  hudEditorWorkingButtonSize = { ...hudEditorWorkingButtonSizes[hudEditorPilotProfile] };
  hudEditorChangedButtonSizes = new Set();
  $('game-menu-modal')?.classList.add('hidden');
  characterHudEditor?.classList.remove('hidden');
  characterHudEditor?.setAttribute('aria-hidden', 'false');
  setHudEditorTarget(hudEditorTarget);
  if (runtimeBridge?.status === 'paused') runtimeBridge.resume();
  toast('Escolha o HUD, ajuste as posições e toque em SALVAR.');
}

allHudEditable.forEach(element => {
  element.addEventListener('pointerdown', event => {
    if (!characterHudEditing || element.dataset.hudScope !== hudEditorTarget ||
        (hudEditorTarget === 'pilot' && element.dataset.hudProfile !== 'all' &&
          !element.dataset.hudProfile.split(/\s+/).includes(hudEditorPilotProfile))) return;
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
$('hud-editor-character-tab')?.addEventListener('click', () => setHudEditorTarget('character'));
$('hud-editor-pilot-tab')?.addEventListener('click', () => setHudEditorTarget('pilot'));
document.querySelectorAll('[data-hud-editor-profile]').forEach(button => {
  button.addEventListener('click', () => setHudEditorPilotProfile(button.dataset.hudEditorProfile));
});
document.querySelectorAll('[data-hud-gameplay-profile]').forEach(button => {
  button.addEventListener('click', () => {
    if (characterHudEditing) return;
    setActivePilotHudProfile(button.dataset.hudGameplayProfile);
  });
});
$('pilot-hud-button-width')?.addEventListener('input', event => {
  hudEditorWorkingButtonSize = {
    width: Number(event.target.value),
    height: Number($('pilot-hud-button-height')?.value) || 52
  };
  hudEditorWorkingButtonSizes[hudEditorPilotProfile] = { ...hudEditorWorkingButtonSize };
  hudEditorChangedButtonSizes.add(hudEditorPilotProfile);
  applyPilotHudButtonSize(hudEditorWorkingButtonSize, true, hudEditorPilotProfile);
});
$('pilot-hud-button-height')?.addEventListener('input', event => {
  hudEditorWorkingButtonSize = {
    width: Number($('pilot-hud-button-width')?.value) || 112,
    height: Number(event.target.value)
  };
  hudEditorWorkingButtonSizes[hudEditorPilotProfile] = { ...hudEditorWorkingButtonSize };
  hudEditorChangedButtonSizes.add(hudEditorPilotProfile);
  applyPilotHudButtonSize(hudEditorWorkingButtonSize, true, hudEditorPilotProfile);
});
$('character-hud-save-btn')?.addEventListener('click', () => finishCharacterHudEditing({ saveChanges: true }));
$('character-hud-cancel-btn')?.addEventListener('click', () => finishCharacterHudEditing());
$('character-hud-reset-btn')?.addEventListener('click', () => finishCharacterHudEditing({ reset: true }));
$('navigation-panel-open-btn')?.addEventListener('click', () => {
  $('navigation-full-panel')?.classList.remove('hidden');
});
$('navigation-panel-close-btn')?.addEventListener('click', () => {
  $('navigation-full-panel')?.classList.add('hidden');
});
applyHudProfileVisibility(activePilotHudProfile);
applyHudLayout('character', readHudLayout('character'));
applyHudLayout('pilot', pilotHudProfiles.getLayout(activePilotHudProfile), activePilotHudProfile);
for (const profile of PILOT_HUD_PROFILES) {
  if (state.settings?.pilotHudProfileButtonSizes
      ? state.settings.pilotHudProfileButtonSizes[profile.id]
      : (['flight', 'combat'].includes(profile.id) && state.settings?.pilotHudButtonSize)) {
    applyPilotHudButtonSize(readPilotHudButtonSize(profile.id), true, profile.id);
  } else {
    clearPilotHudButtonSize(profile.id);
  }
}

/* MENU DE PAUSA */

$('character-camera-btn')?.addEventListener('click', () => {
  characterCameraMode = characterCameraMode === 'first-person'
    ? 'third-person'
    : 'first-person';
  updateCharacterCameraButton();
  if (camera && characterModel) updateCharacterCamera();
});
updateCharacterCameraButton();

$('return-menu-btn')?.addEventListener('click', async () => {
  // Nunca abandonar a sessão enquanto o personagem ainda estiver sentado
  // no console: libera o terminal, devolve o personagem ao convés e
  // restaura o HUD a pé antes de ocultar a tela do jogo.
  if (characterCore.snapshot().mode === 'ship-control') {
    exitPilotMode();
  }

  active = false;
  await runtimeBridge?.shutdown();
  resetTransientState();
  characterControls.reset();

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
