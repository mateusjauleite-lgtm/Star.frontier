import * as THREE from 'three';
import { createLandingGear } from './landingGear.js';
import { isInsideDeck3DeflectorAperture } from './engineering/deflectorAperture.js';
import { createDeflectorAssembly } from './engineering/deflectorAssembly.js';

// Casco principal e duas nacelles da nave exploradora.
// Os grupos de guinada e arfagem são separados para manter os eixos estáveis.
export function createExplorationShip() {
  const group = new THREE.Group();
  group.name = 'StarFrontier-Exploration-Ship';

  const yaw = new THREE.Group();
  yaw.name = 'Flight-Yaw-Around-World-Y';
  group.add(yaw);

  const pitch = new THREE.Group();
  pitch.name = 'Flight-Pitch-Around-Local-X';
  yaw.add(pitch);

  const visual = new THREE.Group();
  visual.name = 'Exploration-Ship-Visual';
  pitch.add(visual);

  const hullMaterial = new THREE.MeshStandardMaterial({
    color: 0xb8c9d7, metalness: 0.78, roughness: 0.3,
    side: THREE.DoubleSide
  });
  const undersideMaterial = new THREE.MeshStandardMaterial({
    color: 0x263d53, metalness: 0.82, roughness: 0.36,
    side: THREE.DoubleSide
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x3b83ae, metalness: 0.7, roughness: 0.28
  });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: 0x31cfff });
  const windowMaterial = new THREE.MeshBasicMaterial({
    color: 0x56d9ff, transparent: true, opacity: 0.82
  });

  const shieldMaterial = new THREE.MeshBasicMaterial({
    color: 0x39cfff,
    transparent: true,
    opacity: 0.055,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const shieldVisual = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 32), shieldMaterial
  );
  shieldVisual.name = 'Deflector-Shield-Envelope';
  shieldVisual.scale.set(31.5, 18.5, 57.5);
  shieldVisual.visible = true;
  shieldVisual.renderOrder = 3;
  visual.add(shieldVisual);

  const addMesh = (geometry, material, position, scale = [1, 1, 1], name = '') => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    if (name) mesh.name = name;
    visual.add(mesh);
    return mesh;
  };

  // Casco em duas conchas: seção superior e inferior, envolvendo os quatro decks.
  // A janela panorâmica é uma abertura real no casco superior:
  // os triângulos da área frontal são separados do casco e recebem vidro translúcido.
  const upperHullSource = new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  const upperPositions = upperHullSource.attributes.position;
  const upperIndices = upperHullSource.index.array;
  const hullIndices = [];
  const windowIndices = [];

  for (let i = 0; i < upperIndices.length; i += 3) {
    const a = upperIndices[i];
    const b = upperIndices[i + 1];
    const c = upperIndices[i + 2];
    const centerX = (upperPositions.getX(a) + upperPositions.getX(b) + upperPositions.getX(c)) / 3;
    const centerY = (upperPositions.getY(a) + upperPositions.getY(b) + upperPositions.getY(c)) / 3;
    const centerZ = (upperPositions.getZ(a) + upperPositions.getZ(b) + upperPositions.getZ(c)) / 3;
    const isPanoramicWindow =
      centerZ < -0.58 && centerZ > -0.94 &&
      Math.abs(centerX) < 0.56 &&
      centerY > 0.35 && centerY < 0.9;

    (isPanoramicWindow ? windowIndices : hullIndices).push(a, b, c);
  }

  const upperHullGeometry = upperHullSource.clone();
  upperHullGeometry.setIndex(hullIndices);
  upperHullGeometry.computeVertexNormals();

  const panoramicGlassGeometry = upperHullSource.clone();
  panoramicGlassGeometry.setIndex(windowIndices);
  panoramicGlassGeometry.computeVertexNormals();
  upperHullSource.dispose();

  const upperHull = addMesh(
    upperHullGeometry,
    hullMaterial, [0, 0, 0], [27.2, 15.2, 50], 'Upper-Saucer-Hull'
  );

  const panoramicGlassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x9bdfff,
    transparent: true,
    opacity: 0.18,
    roughness: 0.08,
    metalness: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  addMesh(
    panoramicGlassGeometry,
    panoramicGlassMaterial,
    [0, 0, 0],
    [27.2, 15.2, 50],
    'Bridge-Panoramic-Window'
  );
  // Abertura real do hangar na popa: removemos os triângulos da concha
  // inferior na região central traseira, acompanhando a curvatura do casco.
  // O recorte usa coordenadas normalizadas da esfera, como a janela frontal.
  const lowerHullSource = new THREE.SphereGeometry(
    1, 64, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2
  );
  const lowerPositions = lowerHullSource.attributes.position;
  const lowerSourceIndices = lowerHullSource.index.array;
  const lowerHullIndices = [];

  for (let i = 0; i < lowerSourceIndices.length; i += 3) {
    const a = lowerSourceIndices[i];
    const b = lowerSourceIndices[i + 1];
    const c = lowerSourceIndices[i + 2];
    const centerX = (
      lowerPositions.getX(a) + lowerPositions.getX(b) + lowerPositions.getX(c)
    ) / 3;
    const centerY = (
      lowerPositions.getY(a) + lowerPositions.getY(b) + lowerPositions.getY(c)
    ) / 3;
    const centerZ = (
      lowerPositions.getZ(a) + lowerPositions.getZ(b) + lowerPositions.getZ(c)
    ) / 3;

    const isAftHangarOpening =
      centerZ > 0.60 &&
      Math.abs(centerX) < 0.36 &&
      centerY > -0.76 && centerY < -0.18;

    // Recorte circular no casco inferior, alinhado ao poço do elevador
    // externo do Deck 4 (coordenadas locais da nave).
    const elevatorDx = centerX * 27.2;
    const elevatorDz = centerZ * 50 - 41.5;
    const isExternalElevatorOpening =
      elevatorDx * elevatorDx + elevatorDz * elevatorDz < 3.2 * 3.2 &&
      centerY < -0.68;

    const isDeck3DeflectorAperture = isInsideDeck3DeflectorAperture(
      centerX, centerY, centerZ
    );

    if (!isAftHangarOpening && !isExternalElevatorOpening && !isDeck3DeflectorAperture) {
      lowerHullIndices.push(a, b, c);
    }
  }

  const lowerHullGeometry = lowerHullSource.clone();
  lowerHullGeometry.setIndex(lowerHullIndices);
  lowerHullGeometry.computeVertexNormals();
  lowerHullSource.dispose();

  addMesh(
    lowerHullGeometry,
    undersideMaterial, [0, 0, 0], [27.2, 15.2, 50], 'Lower-Saucer-Hull'
  );

  const primaryDeflector = createDeflectorAssembly();
  primaryDeflector.name = 'Frontier-Deck3-Primary-Deflector';
  visual.add(primaryDeflector);

  // Console físico do computador central na ponte.
  // Substitui o antigo domo azul; a câmera continua sendo calculada no main.js.
  const bridgeComputer = new THREE.Group();
  bridgeComputer.name = 'Bridge-Computer-Console';
  // Base apoiada diretamente no piso D1 (topo do deck em Y=8.91).
  bridgeComputer.position.set(0, 8.90, -33.2);
  visual.add(bridgeComputer);

  const consoleBase = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 0.48, 2.15), undersideMaterial
  );
  consoleBase.position.set(0, 0.25, 0);
  bridgeComputer.add(consoleBase);

  const consoleBody = new THREE.Mesh(
    new THREE.BoxGeometry(4.35, 0.82, 1.75), trimMaterial
  );
  consoleBody.position.set(0, 0.82, 0);
  bridgeComputer.add(consoleBody);

  const consoleTop = new THREE.Mesh(
    new THREE.BoxGeometry(4.15, 0.12, 1.58), hullMaterial
  );
  consoleTop.position.set(0, 1.28, 0.02);
  bridgeComputer.add(consoleTop);

  const consoleDisplayMaterial = new THREE.MeshStandardMaterial({
    color: 0x123448,
    emissive: 0x087da8,
    emissiveIntensity: 0.85,
    metalness: 0.35,
    roughness: 0.28
  });
  const consoleDisplay = new THREE.Mesh(
    new THREE.BoxGeometry(2.7, 0.08, 0.92), consoleDisplayMaterial
  );
  consoleDisplay.position.set(0, 1.39, 0.02);
  consoleDisplay.rotation.x = -0.16;
  bridgeComputer.add(consoleDisplay);

  const consoleStatus = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.07, 0.34), glowMaterial
  );
  consoleStatus.position.set(-1.55, 1.39, 0.02);
  bridgeComputer.add(consoleStatus);

  // Estação física independente do Ship Computer no lado de bombordo do Deck 1.
  // A frente operacional aponta para +Z, permitindo aproximação pelo corredor.
  const managementStation = new THREE.Group();
  managementStation.name = 'Bridge-Ship-Management-Station';
  managementStation.position.set(-10.5, 8.91, -20);
  visual.add(managementStation);

  const stationDarkMaterial = new THREE.MeshStandardMaterial({
    color: 0x101f2b, metalness: 0.88, roughness: 0.3
  });
  const stationPanelMaterial = new THREE.MeshStandardMaterial({
    color: 0x31556a, metalness: 0.76, roughness: 0.27
  });
  const stationDisplayMaterial = new THREE.MeshStandardMaterial({
    color: 0x092b3c, emissive: 0x087fa8, emissiveIntensity: 1.15,
    metalness: 0.28, roughness: 0.22
  });
  const stationLightMaterial = new THREE.MeshBasicMaterial({
    color: 0x55e5ff, transparent: true, opacity: 0.9
  });

  const stationPart = (name, geometry, material, position, rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    managementStation.add(mesh);
    return mesh;
  };

  stationPart('Management-Station-Floor-Plinth',
    new THREE.BoxGeometry(3.85, 0.22, 2.7), stationDarkMaterial, [0, 0.11, 0]);
  stationPart('Management-Station-Lower-Armor',
    new THREE.BoxGeometry(3.35, 0.72, 2.18), stationPanelMaterial, [0, 0.57, -0.04]);
  stationPart('Management-Station-Operator-Fascia',
    new THREE.BoxGeometry(3.18, 0.52, 0.16), stationDarkMaterial, [0, 0.82, 1.06],
    [-0.12, 0, 0]);
  stationPart('Management-Station-Worktop',
    new THREE.BoxGeometry(3.45, 0.14, 2.12), hullMaterial, [0, 1.12, 0.02],
    [-0.08, 0, 0]);

  // Tela de controle inclinada para o tripulante em pé diante da estação.
  stationPart('Management-Station-Touch-Display',
    new THREE.BoxGeometry(2.55, 0.075, 0.82), stationDisplayMaterial,
    [0, 1.23, 0.48], [-0.34, 0, 0]);

  // Dois módulos laterais reforçam a leitura de equipamento de ponte, sem
  // fechar o acesso frontal nem ocupar o corredor de circulação.
  for (const side of [-1, 1]) {
    stationPart('Management-Station-Side-Module',
      new THREE.BoxGeometry(0.34, 0.94, 1.56), stationDarkMaterial,
      [side * 1.48, 0.78, -0.08]);
    stationPart('Management-Station-Side-Status',
      new THREE.BoxGeometry(0.12, 0.035, 0.72), stationLightMaterial,
      [side * 1.48, 1.27, 0.04]);
    stationPart('Management-Station-Front-Status',
      new THREE.BoxGeometry(0.62, 0.035, 0.035), stationLightMaterial,
      [side * 0.78, 0.88, 1.16]);
  }

  // Linhas luminosas de operação no painel frontal.
  for (let i = 0; i < 5; i += 1) {
    stationPart('Management-Station-Control-Indicator',
      new THREE.BoxGeometry(0.22, 0.035, 0.035), stationLightMaterial,
      [-0.42 + i * 0.21, 1.29, 0.88]);
  }

  stationPart('Management-Station-Emitter-Recess',
    new THREE.CylinderGeometry(0.56, 0.62, 0.08, 32),
    stationDarkMaterial, [0, 1.22, -0.58]);
  stationPart('Management-Station-Emitter-Ring',
    new THREE.TorusGeometry(0.46, 0.025, 8, 40),
    stationLightMaterial, [0, 1.28, -0.58], [Math.PI / 2, 0, 0]);

  // Reforço do casco de engenharia inferior; permanece fora da circulação do D4.
  addMesh(new THREE.SphereGeometry(1, 36, 24), undersideMaterial,
    [0, -10.2, 18], [11.5, 4.8, 25], 'Engineering-Secondary-Hull');

  // Moldura contínua da boca do hangar. Os quatro elementos ficam fora
  // do vão livre, sem pontas triangulares nem travessas atravessando a saída.
  const aftHangarFrame = new THREE.Group();
  aftHangarFrame.name = 'Aft-Hangar-Opening-Frame';
  visual.add(aftHangarFrame);
  const framePart = (name, size, position, material = hullMaterial) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.name = name;
    mesh.position.set(...position);
    aftHangarFrame.add(mesh);
    return mesh;
  };
  framePart('Central-Hangar-Upper-Lip', [22.5, 0.9, 1.4], [0, -1.9, 49.2]);
  framePart('Central-Hangar-Lower-Lip', [22.5, 0.9, 1.4], [0, -12.3, 49.2]);
  framePart('Central-Hangar-Port-Frame', [1.2, 10.8, 1.4], [-10.8, -7.1, 49.2]);
  framePart('Central-Hangar-Starboard-Frame', [1.2, 10.8, 1.4], [10.8, -7.1, 49.2]);

  // Junção externa independente: braços largos e achatados ligam a moldura
  // do hangar às naceles, sem atravessar o volume habitável da nave.
  const aftNacelleJunction = new THREE.Group();
  aftNacelleJunction.name = 'Aft-Hangar-Nacelle-Junction';
  visual.add(aftNacelleJunction);

  const engineFlames = [];
  const engineLights = [];
  for (const side of [-1, 1]) {
    const root = new THREE.Vector3(side * 11.0, -7.1, 49.2);
    const tip = new THREE.Vector3(side * 31.5, -0.8, 55.0);
    const direction = tip.clone().sub(root);
    const supportLength = direction.length();
    const support = new THREE.Mesh(
      new THREE.BoxGeometry(6.2, 3.0, supportLength),
      hullMaterial
    );
    support.name = side < 0
      ? 'Port-External-Aft-Support'
      : 'Starboard-External-Aft-Support';
    support.position.copy(root).add(tip).multiplyScalar(0.5);
    support.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1), direction.normalize()
    );
    support.userData.exteriorOnly = true;
    aftNacelleJunction.add(support);

    const supportLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.14, supportLength * 0.82),
      glowMaterial
    );
    supportLight.name = side < 0
      ? 'Port-Aft-Support-Light-Channel'
      : 'Starboard-Aft-Support-Light-Channel';
    supportLight.position.set(0, 1.55, 0);
    support.add(supportLight);

    // Perfil de seção retangular com cantos chanfrados: corpo alongado,
    // não cilíndrico. A posição X mantém toda a nacelle além do casco (27,2 m).
    const nacelleShape = new THREE.Shape();
    nacelleShape.moveTo(-2.0, -2.15);
    nacelleShape.lineTo(2.0, -2.15);
    nacelleShape.quadraticCurveTo(2.45, -2.15, 2.45, -1.7);
    nacelleShape.lineTo(2.45, 1.7);
    nacelleShape.quadraticCurveTo(2.45, 2.15, 2.0, 2.15);
    nacelleShape.lineTo(-2.0, 2.15);
    nacelleShape.quadraticCurveTo(-2.45, 2.15, -2.45, 1.7);
    nacelleShape.lineTo(-2.45, -1.7);
    nacelleShape.quadraticCurveTo(-2.45, -2.15, -2.0, -2.15);

    // Abertura longitudinal de inspeção no topo: cria espaço real para a câmara interna.
    const chamberX = side * 1.05;
    const chamberOpening = new THREE.Path();
    chamberOpening.absellipse(chamberX, 1.52, 0.57, 0.62, 0, Math.PI * 2, true, 0);
    nacelleShape.holes.push(chamberOpening);

    const nacelle = new THREE.Group();
    nacelle.name = side < 0 ? 'Port-Warp-Nacelle' : 'Starboard-Warp-Nacelle';
    nacelle.position.set(side * 31.5, -0.8, 55);
    nacelle.userData.exteriorOnly = true;
    nacelle.userData.hullClearanceMeters = 31.5 - 2.45 - 0.42 - 27.2;
    aftNacelleJunction.add(nacelle);

    const bodyGeometry = new THREE.ExtrudeGeometry(nacelleShape, {
      depth: 62,
      steps: 1,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.42,
      bevelThickness: 0.42,
      curveSegments: 8
    });
    bodyGeometry.translate(0, 0, -31);
    const body = new THREE.Mesh(bodyGeometry, undersideMaterial);
    body.name = side < 0 ? 'Port-Nacelle-Armored-Body' : 'Starboard-Nacelle-Armored-Body';
    nacelle.add(body);

    const dorsalArmor = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.18, 50), trimMaterial
    );
    dorsalArmor.name = 'Nacelle-Dorsal-Armor';
    dorsalArmor.position.set(0, 2.32, 0);
    nacelle.add(dorsalArmor);

    const plasmaChannel = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.24, 54), glowMaterial
    );
    plasmaChannel.name = 'Nacelle-Plasma-Channel';
    plasmaChannel.position.set(side * 2.05, 0.15, 0);
    nacelle.add(plasmaChannel);

    // Câmara interna de plasma visível através de uma janela técnica superior.
    // A janela fica fora da linha da blindagem dorsal central e não altera o casco.
    const chamberGlass = new THREE.Mesh(
      new THREE.BoxGeometry(1.08, 1.12, 34),
      new THREE.MeshPhysicalMaterial({
        color: 0x65dfff, transparent: true, opacity: 0.22,
        roughness: 0.08, metalness: 0.08, transmission: 0.42,
        thickness: 0.18, depthWrite: false, side: THREE.DoubleSide
      })
    );
    chamberGlass.name = side < 0
      ? 'Port-Nacelle-Internal-Chamber-Glass'
      : 'Starboard-Nacelle-Internal-Chamber-Glass';
    chamberGlass.position.set(chamberX, 1.52, 0);
    nacelle.add(chamberGlass);

    const chamberPlasmaMaterial = new THREE.MeshStandardMaterial({
      color: 0x36cfff, emissive: 0x079bd1, emissiveIntensity: 0.85,
      metalness: 0.12, roughness: 0.16, transparent: true, opacity: 0.9
    });
    const chamberPlasma = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.62, 30), chamberPlasmaMaterial
    );
    chamberPlasma.name = side < 0
      ? 'Port-Nacelle-Internal-Plasma-Chamber'
      : 'Starboard-Nacelle-Internal-Plasma-Chamber';
    chamberPlasma.position.set(chamberX, 1.52, 0);
    chamberPlasma.userData.isNacellePlasmaChamber = true;
    nacelle.add(chamberPlasma);

    const chamberWindow = new THREE.Mesh(
      new THREE.BoxGeometry(1.12, 0.075, 35.5),
      new THREE.MeshPhysicalMaterial({
        color: 0x9beaff, transparent: true, opacity: 0.32,
        roughness: 0.06, metalness: 0.05, transmission: 0.68,
        thickness: 0.08, depthWrite: false, side: THREE.DoubleSide
      })
    );
    chamberWindow.name = side < 0
      ? 'Port-Nacelle-Internal-Chamber-View-Window'
      : 'Starboard-Nacelle-Internal-Chamber-View-Window';
    chamberWindow.position.set(chamberX, 2.18, 0);
    nacelle.add(chamberWindow);

    const forwardCap = new THREE.Mesh(
      new THREE.BoxGeometry(3.9, 4.25, 1.7), trimMaterial
    );
    forwardCap.name = 'Nacelle-Forward-Armor-Cap';
    forwardCap.position.z = -31.25;
    nacelle.add(forwardCap);

    const bussard = new THREE.Mesh(
      new THREE.BoxGeometry(2.65, 3.05, 0.14), glowMaterial
    );
    bussard.name = 'Nacelle-Forward-Field-Emitter';
    bussard.position.z = -32.18;
    nacelle.add(bussard);

    const aftCap = new THREE.Mesh(
      new THREE.BoxGeometry(3.9, 4.25, 1.7), trimMaterial
    );
    aftCap.name = 'Nacelle-Aft-Armor-Cap';
    aftCap.position.z = 31.25;
    nacelle.add(aftCap);

    const engineCore = new THREE.Mesh(
      new THREE.BoxGeometry(2.55, 2.9, 0.2), glowMaterial
    );
    engineCore.name = 'Nacelle-Warp-Engine-Core';
    engineCore.position.z = 32.2;
    nacelle.add(engineCore);

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(1.55, 8, 16),
      new THREE.MeshBasicMaterial({
        color: 0x31cfff, transparent: true, opacity: 0.34
      })
    );
    flame.rotation.x = Math.PI / 2;
    flame.position.z = 38;
    nacelle.add(flame);
    engineFlames.push(flame);

    const engineLight = new THREE.PointLight(0x21bfff, 1.2, 35);
    engineLight.position.set(0, 0, 38);
    nacelle.add(engineLight);
    engineLights.push(engineLight);

    // Alimentação independente por bombordo/estibordo, acompanhando o braço externo.
    // O primeiro trecho corre pela face inferior do casco e não atravessa os decks.
    const feedCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 3.2, -14.55, -2),
      new THREE.Vector3(side * 5.5, -14.45, 18),
      new THREE.Vector3(side * 8.5, -12.8, 37),
      new THREE.Vector3(side * 11.0, -7.8, 49.2),
      new THREE.Vector3(side * 20.5, -2.8, 52.2),
      new THREE.Vector3(side * 29.5, -0.8, 55)
    ]);
    const feedMaterial = new THREE.MeshStandardMaterial({
      color: 0x176d91, emissive: 0x087da8, emissiveIntensity: 0.72,
      metalness: 0.82, roughness: 0.22
    });
    const feedConduit = new THREE.Mesh(
      new THREE.TubeGeometry(feedCurve, 96, 0.24, 10, false), feedMaterial
    );
    feedConduit.name = side < 0
      ? 'Port-Warp-Plasma-Feed-Conduit'
      : 'Starboard-Warp-Plasma-Feed-Conduit';
    feedConduit.userData.isNacellePlasmaConduit = true;
    aftNacelleJunction.add(feedConduit);

    const feedCore = new THREE.Mesh(
      new THREE.TubeGeometry(feedCurve, 96, 0.065, 8, false),
      new THREE.MeshBasicMaterial({
        color: 0x7beaff, transparent: true, opacity: 0.82,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    feedCore.name = side < 0
      ? 'Port-Warp-Plasma-Feed-Core'
      : 'Starboard-Warp-Plasma-Feed-Core';
    feedCore.userData.isNacellePlasmaConduit = true;
    aftNacelleJunction.add(feedCore);
  }

  // Janelas de observação laterais, sem ocupar o espaço interno dos corredores.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      addMesh(
        new THREE.BoxGeometry(0.18, 0.12, 0.72),
        windowMaterial,
        [side * 26.5, 2.5, -34 + i * 10],
        [1, 1, 1],
        'Hull-Observation-Window'
      );
    }
  }


  // Manobradores inferiores: seis bocais compactos integrados à concha existente.
  // A montagem acrescenta apenas componentes externos; não altera casco nem decks.
  const maneuveringFlames = [];
  const maneuveringLights = [];
  const maneuveringThrusterMounts = [
    [-15, -14.8, -25], [15, -14.8, -25],
    [-17, -14.2, 0], [17, -14.2, 0],
    [-12, -13.8, 25], [12, -13.8, 25]
  ];
  maneuveringThrusterMounts.forEach(([x, y, z], index) => {
    const mount = new THREE.Group();
    mount.name = 'Maneuvering-Thruster-Mount-' + (index + 1);
    mount.position.set(x, y, z);
    visual.add(mount);

    const nozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.5, 1.25, 16, 1, false),
      undersideMaterial
    );
    nozzle.name = 'Maneuvering-Thruster-Nozzle-' + (index + 1);
    mount.add(nozzle);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.58, 0.09, 8, 20),
      trimMaterial
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.62;
    mount.add(rim);

    const plume = new THREE.Mesh(
      new THREE.ConeGeometry(0.48, 2.8, 12),
      new THREE.MeshBasicMaterial({
        color: 0x68dfff, transparent: true, opacity: 0.0,
        depthWrite: false, blending: THREE.AdditiveBlending
      })
    );
    plume.rotation.z = Math.PI;
    plume.position.y = -2.05;
    plume.visible = false;
    mount.add(plume);
    maneuveringFlames.push(plume);

    const light = new THREE.PointLight(0x45cfff, 0, 8);
    light.position.y = -1.1;
    mount.add(light);
    maneuveringLights.push(light);
  });

  // Quatro conjuntos compactos de trem de pouso articulado com rodas.
  const { group: landingGear, contactPoints: landingGearContactPoints } =
    createLandingGear(THREE);
  visual.add(landingGear);

  return { group, yaw, pitch, visual, engineFlames, engineLights, maneuveringFlames, maneuveringLights, landingGear, landingGearContactPoints, shieldVisual };
}
