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
    const elevatorDx = centerX * 27.2 - 8.5;
    const elevatorDz = centerZ * 50 - 25;
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

  // Reforço do casco de engenharia inferior.

  addMesh(new THREE.SphereGeometry(1, 36, 24), undersideMaterial,
    [0, -10.2, 18], [11.5, 4.8, 25], 'Engineering-Secondary-Hull');

  // Corpo externo da popa mantido abaixo do piso do Deck 4.
  // Reduzimos apenas a projeção vertical e longitudinal que avançava
  // para dentro do hangar, preservando a largura e a ligação externa.
  addMesh(new THREE.SphereGeometry(1, 32, 20), undersideMaterial,
    [0, -11.0, 39], [9.2, 1.8, 12], 'Integrated-Aft-Engineering-Pod');

  // Junção estrutural única da popa: os dois suportes e as naceles
  // pertencem ao mesmo conjunto de conexão junto ao hangar.
  const aftNacelleJunction = new THREE.Group();
  aftNacelleJunction.name = 'Aft-Hangar-Nacelle-Junction';
  visual.add(aftNacelleJunction);

  // Boca do hangar central: vão livre. Não inserir painel sólido no plano
  // externo, pois ele fecha visualmente a saída do hangar.
  addMesh(new THREE.BoxGeometry(19.6, 0.32, 0.42), trimMaterial,
    [0, -4.55, 53.95], [1, 1, 1], 'Central-Hangar-Upper-Lip');
  addMesh(new THREE.BoxGeometry(19.6, 0.32, 0.42), trimMaterial,
    [0, -9.65, 53.95], [1, 1, 1], 'Central-Hangar-Lower-Lip');

  for (const side of [-1, 1]) {
    const supportCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 7.5, -8.2, 37),
      new THREE.Vector3(side * 9.5, -4.2, 43),
      new THREE.Vector3(side * 11.5, -0.8, 51),
      new THREE.Vector3(side * 12.2, 0.1, 56)
    ]);
    const supportGeometry = new THREE.TubeGeometry(supportCurve, 32, 2.7, 16, false);
    // Longarina achatada e larga, com acabamento metálico integrado ao casco.
    supportGeometry.scale(1, 0.62, 1);
    const support = new THREE.Mesh(supportGeometry, hullMaterial);
    support.name = side < 0 ? 'Port-Integrated-Aft-Support' : 'Starboard-Integrated-Aft-Support';
    aftNacelleJunction.add(support);

    const railCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 7.8, -7.55, 37.4),
      new THREE.Vector3(side * 9.8, -3.55, 43.4),
      new THREE.Vector3(side * 11.8, -0.15, 51.4),
      new THREE.Vector3(side * 12.5, 0.75, 56.4)
    ]);
    const insetRail = new THREE.Mesh(
      new THREE.TubeGeometry(railCurve, 28, 0.24, 10, false),
      trimMaterial
    );
    insetRail.name = side < 0 ? 'Port-Aft-Support-Inset-Rail' : 'Starboard-Aft-Support-Inset-Rail';
    aftNacelleJunction.add(insetRail);
  }

  const engineFlames = [];
  const engineLights = [];

  for (const side of [-1, 1]) {
    // Nacelles recuadas: paralelas ao eixo longitudinal e ligadas à popa integrada.
    const nacelle = new THREE.Group();
    nacelle.name = side < 0 ? 'Port-Warp-Nacelle' : 'Starboard-Warp-Nacelle';
    nacelle.position.set(side * 12.2, 0.1, 61);
    nacelle.scale.setScalar(0.82);
    aftNacelleJunction.add(nacelle);

    // Anel estrutural na raiz da nacelle, encaixado no término do suporte
    // curvo da junção traseira (Z global aproximado 56).
    const rootCollar = new THREE.Mesh(
      new THREE.TorusGeometry(3.3, 0.55, 10, 28),
      undersideMaterial
    );
    rootCollar.name = side < 0 ? 'Port-Nacelle-Root-Collar' : 'Starboard-Nacelle-Root-Collar';
    rootCollar.rotation.x = Math.PI / 2;
    rootCollar.position.z = -5;
    nacelle.add(rootCollar);

    // Perfil oval afunilado, com extremidades arredondadas: substitui o antigo cubo/cilindro.
    const nacelleProfile = [
      new THREE.Vector2(0.15, -37), new THREE.Vector2(1.8, -35.5),
      new THREE.Vector2(2.8, -32), new THREE.Vector2(3.25, -25),
      new THREE.Vector2(3.35, 18), new THREE.Vector2(3.05, 29),
      new THREE.Vector2(2.45, 34.5), new THREE.Vector2(1.2, 37),
      new THREE.Vector2(0.12, 38)
    ];
    const body = new THREE.Mesh(
      new THREE.LatheGeometry(nacelleProfile, 28),
      undersideMaterial
    );
    body.rotation.x = Math.PI / 2;
    nacelle.add(body);

    // Painéis de fluxo e anéis técnicos para dar leitura de nacelle de dobra,
    // mantendo os detalhes dentro do volume já existente da estrutura.
    for (const [index, z] of [-27, -18, 18, 27].entries()) {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(index % 2 === 0 ? 3.18 : 3.28, 0.16, 8, 28),
        trimMaterial
      );
      band.name = `Nacelle-Armor-Band-${side}-${index}`;
      band.rotation.x = Math.PI / 2;
      band.position.z = z;
      nacelle.add(band);
    }

    const upperSpine = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.22, 48),
      trimMaterial
    );
    upperSpine.name = side < 0 ? 'Port-Nacelle-Dorsal-Spine' : 'Starboard-Nacelle-Dorsal-Spine';
    upperSpine.position.set(0, 2.95, 0);
    nacelle.add(upperSpine);

    const nacelleGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.5, 54), glowMaterial
    );
    nacelleGlow.position.set(side * 2.85, 0.35, 0);
    nacelle.add(nacelleGlow);

    const forwardCap = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 20, 14),
      trimMaterial
    );
    forwardCap.position.z = -36.2;
    forwardCap.scale.set(1, 1, 0.35);
    nacelle.add(forwardCap);

    const bussard = new THREE.Mesh(
      new THREE.SphereGeometry(2.25, 20, 14),
      glowMaterial
    );
    bussard.position.z = -36.8;
    bussard.scale.z = 0.42;
    nacelle.add(bussard);

    const aftRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.05, 0.42, 10, 28),
      trimMaterial
    );
    aftRing.position.z = 35.8;
    nacelle.add(aftRing);

    const engineCore = new THREE.Mesh(
      new THREE.SphereGeometry(2.45, 20, 14),
      glowMaterial
    );
    engineCore.position.z = 36.6;
    engineCore.scale.z = 0.48;
    nacelle.add(engineCore);

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(1.65, 8, 16),
      new THREE.MeshBasicMaterial({
        color: 0x31cfff, transparent: true, opacity: 0.34
      })
    );
    flame.rotation.x = Math.PI / 2;
    flame.position.z = 40;
    nacelle.add(flame);
    engineFlames.push(flame);

    const engineLight = new THREE.PointLight(0x21bfff, 1.2, 35);
    engineLight.position.set(0, 0, 38);
    nacelle.add(engineLight);
    engineLights.push(engineLight);
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
