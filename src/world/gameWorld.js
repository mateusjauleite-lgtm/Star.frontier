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
import { createCharacterAnimator } from '../character/characterAnimator.js';
import { createCharacterWeaponController } from '../character/characterWeaponController.js';
import { createCharacterPhysics } from '../character/characterPhysics.js';
import { loadGravityKernel } from '../physics/gravityKernel.js';
import { createShipOrbitalTelemetrySource } from '../ships/flight/orbitalTelemetrySource.js';

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
  scene.fog = new THREE.FogExp2(0x020817, 0.00055);

  earthSystem = createEarthCore({ radius: 600, position: [0, 0, -850] });
  scene.add(earthSystem.group);
  const earthReferenceFrames = createEarthReferenceFrames({
    globalFrame: scene,
    terrestrialFrame: earthSystem.getSurfaceFrame()
  });

  const camera = new THREE.PerspectiveCamera(
    70,
    viewport.width / viewport.height,
    0.1,
    20000
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
    center: [310, 0, -300],
    spread: [190, 100, 160]
  });
  const asteroids = asteroidSystem.asteroids;

  await loadingStep(84, 'Carregando estação orbital e observatório...');

  const stationSystem = createStation({ position: [24, 3, -65] });
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

  // Marcador visual experimental preexistente; não é registrado como entidade,
  // não recebe IA e permanece fora do controle do personagem.
  const npc = new THREE.Mesh(
    new THREE.SphereGeometry(1.3, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffc05b,
      emissive: 0x553000
    })
  );
  npc.position.set(24, 3, -77);
  scene.add(npc);

  const orbitSystem = createOrbitSystem({ center: [0, 0, -850], radius: 960 });
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
