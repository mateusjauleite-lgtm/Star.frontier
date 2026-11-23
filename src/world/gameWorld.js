import { createEarthReferenceFrames } from './earth/earthReferenceFrames.js';
import { createEarthCore } from './earth/earthCore.js';
import { createStation } from './station.js';
import { createShipLandingAutopilot } from '../ships/flight/landingAutopilot.js';
import { loadShipFlightKernel } from '../ships/flight/shipFlightKernel.js';
import { createOrbitSystem } from './orbits.js';
import { createAsteroidField } from './asteroids.js';
import { createSpaceLighting } from './lighting.js';
import { createStarshipInterior } from '../ships/interior.js';
import { createExternalElevator } from '../ships/externalElevator.js';
import { createExplorationShip } from '../ships/exploration.js';
import { createCharacterModel } from '../character/characterModel.js';
import { createCharacterSystem } from '../character/index.js';
import { createCharacterAnimator } from '../character/characterAnimator.js';
import { createCharacterWeaponController } from '../character/characterWeaponController.js';
import { createCharacterPhysics } from '../character/characterPhysics.js';
import { loadGravityKernel } from '../physics/gravityKernel.js';
import { createShipOrbitalTelemetrySource } from '../ships/flight/orbitalTelemetrySource.js';
import {
  EARTH_RENDER_RADIUS_UNITS,
  EARTH_WORLD_CENTER,
  EARTH_ORBIT_RADIUS_UNITS,
  ASTEROID_FIELD_CENTER,
  ASTEROID_FIELD_SPREAD,
  STATION_WORLD_POSITION
} from './earth/worldScale.js';

export async function createGameWorld({
  THREE,
  state,
  gameRoot,
  viewport,
  loadingStep,
  characterCore,
  characterEquipment,
  characterYaw,
  shipLandingTelemetry
}) {
  if (!THREE || !state || !gameRoot || !viewport || !characterCore || !characterEquipment) {
    throw new TypeError('Dependências obrigatórias para criar o mundo não foram fornecidas.');
  }

  let scene = new THREE.Scene();
  let renderer = null;
  let earthSystem = null;
  let shipFlightKernel = null;
  let gravityKernel = null;

  try {
  scene.background = new THREE.Color(0x020817);
  scene.fog = new THREE.FogExp2(0x020817, 0.000055);

  earthSystem = createEarthCore({
    radius: EARTH_RENDER_RADIUS_UNITS,
    position: EARTH_WORLD_CENTER
  });
  scene.add(earthSystem.group);
  const earthReferenceFrames = createEarthReferenceFrames({
    globalFrame: scene,
    terrestrialFrame: earthSystem.getSurfaceFrame()
  });

  const camera = new THREE.PerspectiveCamera(
    70,
    viewport.width / viewport.height,
    0.1,
    60000
  );

  renderer = new THREE.WebGLRenderer({
    antialias: state.settings.quality !== 'Baixa',
    powerPreference: 'high-performance'
  });

  renderer.setPixelRatio(
    Math.min(
      viewport.devicePixelRatio,
      state.settings.quality === 'Alta' ? 1.7 : 1.25
    )
  );

  renderer.setSize(viewport.width, viewport.height);
  gameRoot.appendChild(renderer.domElement);

  await loadingStep(24, 'Preparando o espaço e a iluminação...');

  const lightingSystem = createSpaceLighting(scene);
  const stars = lightingSystem.stars;

  await loadingStep(42, 'Montando a nave exploradora de quatro decks...');

  const explorationShip = createExplorationShip();
  const ship = explorationShip.group;
  const shipYaw = explorationShip.yaw;
  const shipPitch = explorationShip.pitch;
  const shipVisual = explorationShip.visual;
  const shipLandingGear = explorationShip.landingGear;
  const shipLandingGearContactPoints = explorationShip.landingGearContactPoints;
  const shieldVisual = explorationShip.shieldVisual;
  shipFlightKernel = await loadShipFlightKernel();
  gravityKernel = await loadGravityKernel();
  const shipLandingAutopilot = createShipLandingAutopilot(shipFlightKernel);
  shipLandingTelemetry?.reset?.();
  const engineFlames = explorationShip.engineFlames;
  const engineLights = explorationShip.engineLights;
  scene.add(ship);

  await loadingStep(70, 'Carregando campo de asteroides...');

  const asteroidSystem = createAsteroidField(scene, {
    count: 24,
    center: ASTEROID_FIELD_CENTER,
    spread: ASTEROID_FIELD_SPREAD
  });
  const asteroids = asteroidSystem.asteroids;

  await loadingStep(84, 'Carregando estação orbital e observatório...');

  const stationSystem = createStation({ position: STATION_WORLD_POSITION });
  scene.add(stationSystem.group);

  await loadingStep(90, 'Integrando os quatro decks ao casco da nave...');
  const starshipInterior = createStarshipInterior({ position: [0, 0, 0] });
  shipVisual.add(starshipInterior.group);
  const externalElevator = createExternalElevator({
    deckY: starshipInterior.layout.decks[3].y
  });
  shipVisual.add(externalElevator.group);
  const activeDeckIndex = 0;
  const nearbyElevator = false;

  const characterModel = createCharacterModel({ clothingColor: 0x526879 });
  characterEquipment.initialize();
  characterModel.group.position.set(0, 8.91, -18);
  characterModel.group.rotation.y = characterYaw;
  shipVisual.add(characterModel.group);
  const characterAnimator = createCharacterAnimator(characterModel);
  const characterWeaponController = createCharacterWeaponController(characterModel);
  const characterPhysics = createCharacterPhysics({ gravityKernel });
  characterPhysics.reset(characterModel.group.position.y);
  characterCore.setGrounded(true);
  characterAnimator.play('idle');

  // O segundo ator é o corpo físico da Alexia. Seu core é independente do jogador;
  // a IA permanece única e será injetada pelo Runtime via Ship Computer.
  const alexiaCharacter = createCharacterSystem({
    model: { gender: 'female', clothingColor: 0x2f7188, hairColor: 0x202b35 },
    physics: { gravityKernel },
    initialHeight: 8.91,
    audio: false
  });
  alexiaCharacter.group.name = 'alexia-character-root';
  alexiaCharacter.group.position.set(2.35, 8.91, -18);
  alexiaCharacter.group.rotation.y = characterYaw + Math.PI / 2;
  shipVisual.add(alexiaCharacter.group);

  const orbitSystem = createOrbitSystem({
    center: EARTH_WORLD_CENTER,
    radius: EARTH_ORBIT_RADIUS_UNITS
  });
  scene.add(orbitSystem.group);

  await loadingStep(96, 'Finalizando cenário e sistemas de voo...');

  return {
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
    orbitalTelemetrySource: createShipOrbitalTelemetrySource({ THREE, earthSystem, ship, shipVisual }),
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
    alexiaCharacter,
    characterAnimator,
    characterWeaponController,
    characterPhysics
  };
  } catch (error) {
    try { earthSystem?.dispose?.(); } catch (disposeError) {
      console.warn('Falha ao liberar os módulos da Terra:', disposeError);
    }
    try { shipFlightKernel?.dispose?.(); } catch (disposeError) {
      console.warn('Falha ao liberar o kernel orbital da nave:', disposeError);
    }
    try { gravityKernel?.dispose?.(); } catch (disposeError) {
      console.warn('Falha ao liberar o kernel de gravidade:', disposeError);
    }
    scene?.traverse(object => {
      if (!object.isMesh && !object.isLine && !object.isPoints) return;
      object.geometry?.dispose?.();
      const materials = Array.isArray(object.material)
        ? object.material
        : object.material ? [object.material] : [];
      materials.forEach(material => material?.dispose?.());
    });
    renderer?.dispose?.();
    renderer?.forceContextLoss?.();
    renderer?.domElement?.remove?.();
    throw error;
  }
}
