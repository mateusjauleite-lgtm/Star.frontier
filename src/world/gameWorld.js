import { createEarthReferenceFrames } from './earth/earthReferenceFrames.js';
import { createEarthCore } from './earth/earthCore.js';
import { createEarthTerrainReferenceCore } from './earth/earthTerrainReferenceCore.js';
import { createPlanetaryTransportCore } from '../ships/computer/planetaryTransportCore.js';
import { createMoonCore } from './moon/moonCore.js';
import { MOON_PLANETARY_PROFILE } from './moon/moonProfile.js';
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
import { createPlanetaryGravitySystem } from '../physics/planetaryGravitySystem.js';
import { createSolarSystemDynamics } from '../physics/solarSystemDynamics.js';
import { createSolarSystemPresentationAdapter } from './solarSystemPresentation.js';
import { createShipOrbitalTelemetrySource } from '../ships/flight/orbitalTelemetrySource.js';
import {
  EARTH_RENDER_RADIUS_UNITS,
  EARTH_WORLD_SCALE_FACTOR,
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
  let earthTerrainReferenceCore = null;
  let planetaryTransportCore = null;
  let moonSystem = null;
  let shipFlightKernel = null;
  let gravityKernel = null;
  let solarSystemDynamics = null;

  try {
  scene.background = new THREE.Color(0x020817);
  // Preserve visibility across interplanetary distances; local haze remains negligible in vacuum.
  scene.fog = new THREE.FogExp2(0x020817, 0.00055 / (EARTH_WORLD_SCALE_FACTOR * 1000));

  earthSystem = createEarthCore({
    radius: EARTH_RENDER_RADIUS_UNITS,
    position: EARTH_WORLD_CENTER
  });
  scene.add(earthSystem.group);
  const earthReferenceFrames = createEarthReferenceFrames({
    globalFrame: scene,
    terrestrialFrame: earthSystem.getSurfaceFrame()
  });
  earthTerrainReferenceCore = createEarthTerrainReferenceCore({
    THREE, earthSystem, scene,
    onReferenceRegistered: reference => planetaryTransportCore?.registerDestination({
      id: reference.id,
      name: reference.name,
      bodyId: 'earth',
      latitudeDeg: reference.latitudeDeg,
      longitudeDeg: reference.longitudeDeg,
      elevationMeters: reference.elevationMeters,
      sourceId: reference.id,
      tags: ['terrain-reference', reference.sourceFormat]
    })
  });

  // A Lua possui grupo e referencial próprios; sua posição nunca é parentada à Terra.
  // O runtime astronômico atualiza a transformação a partir do estado N-body em SI.
  moonSystem = createMoonCore({
    earthSystem,
    visualUnitsPerMeter: 1,
    visualRadiusUnits: MOON_PLANETARY_PROFILE.physical.meanRadiusMeters
  });
  scene.add(moonSystem.group);
  scene.userData.moonSystem = moonSystem;

  const camera = new THREE.PerspectiveCamera(
    70,
    viewport.width / viewport.height,
    0.1,
    60000 * EARTH_WORLD_SCALE_FACTOR
  );

  renderer = new THREE.WebGLRenderer({
    antialias: state.settings.quality !== 'Baixa',
    powerPreference: 'high-performance',
    logarithmicDepthBuffer: true
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

  const lightingSystem = createSpaceLighting(scene, {
    worldScaleFactor: EARTH_WORLD_SCALE_FACTOR
  });
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
  solarSystemDynamics = createSolarSystemDynamics({ gravityKernel });
  const solarSystemPresentation = createSolarSystemPresentationAdapter(THREE, {
    visualUnitsPerMeter: EARTH_RENDER_RADIUS_UNITS / 6_371_008.8,
    anchorBodyId: 'earth',
    sunBodyId: 'sun'
  });
  // Publica a posição inicial da Lua antes de registrar seu campo gravitacional,
  // evitando um corpo temporariamente situado na origem da cena durante o boot.
  moonSystem.applyAstronomicalState(
    solarSystemPresentation.getFrame(solarSystemDynamics.getSnapshot())
  );
  const planetaryGravitySystem = createPlanetaryGravitySystem({
    getEarthCenter: () => earthSystem.group.getWorldPosition(new THREE.Vector3()).toArray(),
    getEarthSpinAxis: () => {
      const rotationState = earthSystem.getSurfaceRotationState();
      if (!rotationState?.localAxis) return [0, 1, 0];
      return rotationState.localAxis.clone()
        .applyQuaternion(earthSystem.group.getWorldQuaternion(new THREE.Quaternion()))
        .normalize().toArray();
    },
    gravityKernel,
    gravitationalParameter: earthSystem.getPlanetaryProfile().physical.gravitationalParameterM3S2,
    getAdditionalGravityBodies: () => {
      if (!moonSystem) return [];
      moonSystem.group.updateWorldMatrix(true, false);
      const moonCenter = moonSystem.group.getWorldPosition(new THREE.Vector3()).toArray();
      return [{
        position: moonCenter,
        mu: MOON_PLANETARY_PROFILE.physical.gravitationalParameterM3S2
      }];
    }
  });
  earthSystem.setPlanetaryGravitySystem(planetaryGravitySystem);
  const shipLandingAutopilot = createShipLandingAutopilot(shipFlightKernel);
  shipLandingTelemetry?.reset?.();
  const engineFlames = explorationShip.engineFlames;
  const engineLights = explorationShip.engineLights;
  const maneuveringFlames = explorationShip.maneuveringFlames;
  const maneuveringLights = explorationShip.maneuveringLights;
  scene.add(ship);
  planetaryTransportCore = createPlanetaryTransportCore({
    resolveDestination: (destination, { altitudeOffsetMeters }) => {
      const placement = earthTerrainReferenceCore.resolveSurfacePosition({
        latitudeDeg: destination.latitudeDeg,
        longitudeDeg: destination.longitudeDeg,
        elevationMeters: destination.elevationMeters + altitudeOffsetMeters
      });
      return { position: placement.worldPosition, normal: placement.worldNormal };
    },
    getActors: () => ({ ship, character: characterModel.group }),
    moveActor: (actor, resolved, { actor: actorId } = {}) => {
      if (actorId === 'character') scene.attach(actor);
      actor.position.copy(resolved.position);
      actor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), resolved.normal);
      actor.updateMatrixWorld(true);
      return true;
    },
    consumePower: amount => state.requestOperationsPower?.(amount, 1) ?? 0,
    getPowerStatus: () => ({
      available: Boolean(state.warpCorePowerBusConnected && state.warpCoreEnabled !== false &&
        state.warpCoreContainmentStable !== false && state.warpCoreMatrixEnabled !== false),
      bus: 'OPERATIONS EPS',
      energy: Math.max(0, Number(state.warpCoreOperationsBuffer) || 0)
    }),
    energyCost: 8,
    enabled: true
  });

  await loadingStep(70, 'Carregando campo de asteroides...');

  const asteroidSystem = createAsteroidField(scene, {
    count: 24,
    center: ASTEROID_FIELD_CENTER,
    spread: ASTEROID_FIELD_SPREAD,
    gravitySystem: planetaryGravitySystem
  });
  const asteroids = asteroidSystem.asteroids;

  await loadingStep(84, 'Carregando estação orbital e observatório...');

  // Exceção explícita da simulação: a estação permanece fixa e não recebe aceleração gravitacional.
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
    radius: EARTH_ORBIT_RADIUS_UNITS,
    gravitySystem: planetaryGravitySystem
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
    earthTerrainReferenceCore,
    planetaryTransportCore,
    moonSystem,
    earthReferenceFrames,
    stationSystem,
    shipFlightKernel,
    gravityKernel,
    planetaryGravitySystem,
    solarSystemDynamics,
    solarSystemPresentation,
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
    maneuveringFlames,
    maneuveringLights,
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
    try { earthTerrainReferenceCore?.dispose?.(); } catch (disposeError) {
      console.warn('Falha ao liberar referências de terreno da Terra:', disposeError);
    }
    try { moonSystem?.dispose?.(); } catch (disposeError) {
      console.warn('Falha ao liberar os módulos da Lua:', disposeError);
    }
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
