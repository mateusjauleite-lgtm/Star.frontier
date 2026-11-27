import * as THREE from 'three';
import { createEngineeringWarpCore } from './engineering/warpCore.js';
import { createDilithiumMatrix } from './engineering/dilithiumMatrix.js';
import { createDilithiumProcessingPlant } from './engineering/dilithiumProcessingPlant.js';
import { DECK_3_DEFLECTOR_APERTURE } from './engineering/deflectorAperture.js';
import { createDeflectorInteriorStructure } from './engineering/deflectorInteriorStructure.js';
import { createDeck2TransporterInstallation } from './transport/transportInstallation.js';
import { createShipLightingCore } from './lighting/shipLightingCore.js';
import { createShipLightingConsole } from './lighting/shipLightingConsole.js';

// Estrutura física inicial da nave exploradora.
// Escala de trabalho: 120 x 64 x 32 m. Sem consoles, máquinas ou mobiliário.
export const STARSHIP_LAYOUT = Object.freeze({
  length: 120,
  width: 64,
  height: 32,
  deckHeight: 5.8,
  decks: [
    { id: 'D1', name: 'Ponte de comando', y: 8.7 },
    { id: 'D2', name: 'Operações e ciência', y: 2.9 },
    { id: 'D3', name: 'Engenharia', y: -2.9 },
    { id: 'D4', name: 'Hangar e apoio', y: -8.7 }
  ]
});

export function createStarshipInterior(options = {}) {
  const group = new THREE.Group();
  group.name = 'StarFrontier-ExplorationShip-Interior';
  const position = options.position || [0, 0, 0];
  group.position.set(...position);

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x34495b, metalness: 0.72, roughness: 0.48
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x8fa4b5, metalness: 0.68, roughness: 0.42
  });
  const bulkheadMat = new THREE.MeshStandardMaterial({
    color: 0x1b3043, metalness: 0.82, roughness: 0.38
  });
  const trimMat = new THREE.MeshBasicMaterial({ color: 0x39bce8 });
  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0x172737, metalness: 0.7, roughness: 0.55
  });
  const collisionBoxes = [];

  // Ray casting 2D: Three.js ShapeUtils não expõe isPointInsidePolygon.
  const isPointInsidePolygon = (point, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const a = polygon[i];
      const b = polygon[j];
      const crosses = ((a.y > point.y) !== (b.y > point.y)) &&
        (point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x);
      if (crosses) inside = !inside;
    }
    return inside;
  };

  // Faixas planas geradas a partir do contorno real de cada piso.
  // A busca encontra a borda lateral do polígono e recua alguns metros,
  // sem tocar paredes, criar colisores ou alterar a malha estrutural.
  const createFloorSideStripGeometry = (contour, centerZ, side, requestedStart, requestedEnd) => {
    const polygon = contour.map(([x, z]) => new THREE.Vector2(x, z));
    const worldZValues = contour.map(([, z]) => z + centerZ);
    const floorStart = Math.min(...worldZValues);
    const floorEnd = Math.max(...worldZValues);
    const zStart = Math.max(requestedStart, floorStart + 3.5);
    const zEnd = Math.min(requestedEnd, floorEnd - 3.5);
    if (zEnd <= zStart) throw new RangeError('Trecho de faixa inválido para o piso.');

    const positions = [];
    const indices = [];
    const step = 0.22;
    const samples = Math.ceil((zEnd - zStart) / step);
    let previousRow = -1;
    let previousZ = null;
    let firstVisibleZ = null;
    let lastVisibleZ = null;

    for (let i = 0; i <= samples; i += 1) {
      const z = zStart + ((zEnd - zStart) * i) / samples;
      const localZ = z - centerZ;
      let edge = 0;
      for (let distance = 0.25; distance <= 32; distance += 0.2) {
        if (isPointInsidePolygon(new THREE.Vector2(side * distance, localZ), polygon)) edge = distance;
      }

      // Ausência de piso (ex.: recorte do defletor) interrompe a faixa;
      // nunca ligamos uma ponte luminosa atravessando uma abertura.
      if (edge < 5) {
        previousRow = -1;
        previousZ = null;
        continue;
      }

      const centerX = side * (edge - 3.2);
      const innerX = centerX - side * 0.09;
      const outerX = centerX + side * 0.09;
      const row = positions.length / 3;
      positions.push(innerX, 0.205, z, outerX, 0.205, z);

      if (previousRow >= 0 && previousZ !== null && z - previousZ <= step * 1.5) {
        const a = previousRow;
        const b = previousRow + 1;
        const c = row + 1;
        const d = row;
        indices.push(a, b, d, b, c, d);
      }
      previousRow = row;
      previousZ = z;
      if (firstVisibleZ === null) firstVisibleZ = z;
      lastVisibleZ = z;
    }

    if (indices.length === 0) throw new RangeError('O contorno do piso não possui lateral útil para a faixa.');
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.userData.floorRange = { start: firstVisibleZ, end: lastVisibleZ };
    return geometry;
  };

  const addBox = (parent, size, at, material, name = '') => {
    const isHullFitted = /Wall|Partition|Bulkhead|Frame/.test(name);
    if (!isHullFitted) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.position.set(...at);
      if (name) mesh.name = name;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }

    // Paredes e anteparas acompanham o volume elipsoidal do casco.
    // Dividimos cada peça em lâminas curtas e recortamos topo/base pela
    // superfície real do casco; a mesma geometria recortada gera a colisão.
    const [width, height, depth] = size;
    const alongX = width >= depth;
    const run = alongX ? width : depth;
    const thickness = alongX ? depth : width;
    const slices = Math.max(1, Math.ceil(run / 0.5));
    const sliceRun = run / slices;
    const meshes = [];

    for (let i = 0; i < slices; i++) {
      const offset = -run / 2 + (i + 0.5) * sliceRun;
      const x = at[0] + (alongX ? offset : 0);
      const z = at[2] + (alongX ? 0 : offset);
      const hullTerm = 1 - (x * x) / (27.2 * 27.2) - (z * z) / (50 * 50);
      if (hullTerm <= 0) continue;

      const hullY = 15.2 * Math.sqrt(hullTerm);
      const wallBottom = Math.max(at[1] - height / 2, -hullY);
      const wallTop = Math.min(at[1] + height / 2, hullY);
      if (wallTop - wallBottom < 0.08) continue;

      const segmentSize = alongX
        ? [sliceRun + 0.015, wallTop - wallBottom, thickness]
        : [thickness, wallTop - wallBottom, sliceRun + 0.015];
      const segmentPosition = [
        x,
        (wallTop + wallBottom) / 2,
        z
      ];
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...segmentSize), material);
      mesh.position.set(...segmentPosition);
      if (name) mesh.name = name;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      parent.add(mesh);
      meshes.push(mesh);

      collisionBoxes.push({
        x, y: segmentPosition[1], z,
        halfX: segmentSize[0] / 2,
        halfY: segmentSize[1] / 2,
        halfZ: segmentSize[2] / 2
      });
    }

    return meshes[0] || null;
  };

  // Parede com vão central para futura instalação de porta.
  const doorwayWallX = (x, y, z, length, height, thickness, doorWidth = 2.4, doorHeight = 2.8) => {
    const side = (length - doorWidth) / 2;
    addBox(group, [side, height, thickness], [x - doorWidth / 2 - side / 2, y, z], wallMat, 'Wall-Door-Left');
    addBox(group, [side, height, thickness], [x + doorWidth / 2 + side / 2, y, z], wallMat, 'Wall-Door-Right');
    addBox(group, [doorWidth, height - doorHeight, thickness], [x, y + doorHeight / 2, z], bulkheadMat, 'Wall-Door-Header');
  };

  const doorwayWallZ = (x, y, z, length, height, thickness, doorWidth = 2.4, doorHeight = 2.8) => {
    const side = (length - doorWidth) / 2;
    addBox(group, [thickness, height, side], [x, y, z - doorWidth / 2 - side / 2], wallMat, 'Wall-Door-Left');
    addBox(group, [thickness, height, side], [x, y, z + doorWidth / 2 + side / 2], wallMat, 'Wall-Door-Right');
    addBox(group, [thickness, height - doorHeight, doorWidth], [x, y + doorHeight / 2, z], bulkheadMat, 'Wall-Door-Header');
  };

  const addDeckPlate = (y, width, length, material, name, thickness, centerZ = -2) => {
    // Planta elíptica acompanha o casco arredondado. D2 e D3 mantêm
    // a mesma dimensão externa dos decks, mas abrem uma reentrância na proa
    // para o volume estrutural do defletor, sem deixar triângulos sob o emissor.
    let shape;
    if (name === 'D2-Floor' || name === 'D3-Floor') {
      const outerRadiusX = width / 2;
      const outerRadiusZ = length / 2;
      const notchRadiusX = name === 'D2-Floor'
        ? DECK_3_DEFLECTOR_APERTURE.radiusX
        : 9.35;
      const notchRadiusZ = name === 'D2-Floor'
        ? DECK_3_DEFLECTOR_APERTURE.radiusZ
        : 6.25;
      const notchCenterZ = DECK_3_DEFLECTOR_APERTURE.centerZ - centerZ;
      const outerY = -outerRadiusZ * Math.sqrt(1 - (notchRadiusX / outerRadiusX) ** 2);
      const rightAngle = Math.atan2(outerY / outerRadiusZ, notchRadiusX / outerRadiusX);
      const leftAngle = Math.PI - rightAngle;
      shape = new THREE.Shape();
      shape.moveTo(notchRadiusX, outerY);

      if (name === 'D3-Floor') {
        // A popa do Deck 3 afunila junto com o teto do hangar D4.
        shape.quadraticCurveTo(outerRadiusX, -20, outerRadiusX, 0);
        shape.quadraticCurveTo(outerRadiusX, 12, 20, 28);
        shape.quadraticCurveTo(15, 42, 8, 45);
        shape.quadraticCurveTo(0, 47, -8, 45);
        shape.quadraticCurveTo(-15, 42, -20, 28);
        shape.quadraticCurveTo(-outerRadiusX, 12, -outerRadiusX, 0);
        shape.quadraticCurveTo(-outerRadiusX, -20, -notchRadiusX, outerY);
      } else {
        const outerSteps = 96;
        for (let i = 1; i <= outerSteps; i++) {
          const angle = rightAngle + ((leftAngle - rightAngle) * i) / outerSteps;
          shape.lineTo(outerRadiusX * Math.cos(angle), outerRadiusZ * Math.sin(angle));
        }
      }

      // Reentra pela curva da folga do defletor; a abertura fica ligada
      // à borda frontal do convés, evitando furos parcialmente externos.
      const innerSteps = 48;
      for (let i = 1; i <= innerSteps; i++) {
        const angle = Math.PI - (Math.PI * i) / innerSteps;
        shape.lineTo(
          notchRadiusX * Math.cos(angle),
          notchCenterZ + notchRadiusZ * Math.sin(angle)
        );
      }
      shape.closePath();

      if (name === 'D2-Floor') {
        const engineeringCoreOpening = new THREE.Path();
        engineeringCoreOpening.absellipse(0, -2 - centerZ, 3.58, 3.58, 0, Math.PI * 2, true, 0);
        shape.holes.push(engineeringCoreOpening);
      }
    } else if (name === 'D4-Floor') {
      // Convés do hangar: laterais amplas no centro e popa estreita,
      // acompanhando o casco e deixando o vão traseiro contínuo.
      shape = new THREE.Shape();
      shape.moveTo(0, -49);
      shape.bezierCurveTo(-18, -49, -24, -38, -24, -20);
      shape.bezierCurveTo(-24, 5, -20, 25, -15, 36);
      shape.quadraticCurveTo(-11, 44, -7.5, 46);
      shape.quadraticCurveTo(0, 48, 7.5, 46);
      shape.quadraticCurveTo(11, 44, 15, 36);
      shape.bezierCurveTo(20, 25, 24, 5, 24, -20);
      shape.bezierCurveTo(24, -38, 18, -49, 0, -49);
    } else {
      shape = new THREE.Shape();
      shape.absellipse(0, 0, width / 2, length / 2, 0, Math.PI * 2, false, 0);
    }
    if (name === 'D4-Floor') {
      // Poço do elevador dentro do hangar, alinhado à saída traseira.
      const elevatorHatch = new THREE.Path();
      elevatorHatch.absellipse(0, 41.5 - centerZ, 2.65, 2.65, 0, Math.PI * 2, true, 0);
      shape.holes.push(elevatorHatch);
    }
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness, bevelEnabled: false, curveSegments: 48
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2;
    // A superfície do piso fica ligeiramente abaixo da origem do personagem,
    // deixando as solas acima do plano sem alterar a altura lógica de caminhada.
    mesh.position.set(0, y + 0.18, centerZ);
    mesh.name = name;
    mesh.userData.deckFootprint = { width, length, centerZ };
    mesh.userData.floorContour = shape.getPoints(256).map(point => [point.x, point.y]);
    mesh.userData.floorTopY = y + 0.18;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  const deckFloor = (deck, label) => {
    const y = deck.y;
    // D1 acompanha a seção mais estreita do casco nas laterais.
    // D2 e D3 compartilham a planta ampliada até o contorno do casco,
    // usando a região do elevador (Z=25) como referência traseira.
    // D4 recebe uma planta afunilada, alinhada à abertura do hangar.
    const footprints = {
      D1: [44, 82], D2: [52, 96], D3: [52, 96], D4: [48, 98, 0]
    };
    const [width, length, centerZ = -2] = footprints[deck.id];
    addDeckPlate(y, width, length, floorMat, label + '-Floor', 0.04, centerZ);
    // O piso do deck imediatamente superior já funciona como teto deste deck.
    // Não criar placas de teto independentes: elas duplicavam os planos entre
    // os decks e produziam sobreposições visuais no hangar. No D1, o casco
    // superior fecha o ambiente.
    // Acesso técnico permanece marcado no piso, dentro da área útil.
    addBox(group, [5.8, 0.035, 5.8], [0, y + 0.23, 25], shaftMat, label + '-Reserved-Vertical-Access');
  };

  for (const deck of STARSHIP_LAYOUT.decks) {
    deckFloor(deck, deck.id);
  }

  // Núcleo lógico e oito faixas embutidas visualmente nos pisos.
  // A geometria usa o contorno efetivo de cada convés, com recuo de 3,2 m
  // da borda lateral e margem longitudinal de segurança.
  const lightingCore = createShipLightingCore({ decks: STARSHIP_LAYOUT.decks });
  group.add(lightingCore.group);
  const floorLightRanges = {
    D1: { start: -28.5, end: 40 },
    D2: { start: -34.4, end: 46 },
    D3: { start: -34.4, end: 42 },
    D4: { start: -39.2, end: 36 }
  };
  for (const deck of STARSHIP_LAYOUT.decks) {
    const floor = group.getObjectByName(`${deck.id}-Floor`);
    const range = floorLightRanges[deck.id];
    const contour = floor.userData.floorContour;
    for (const side of [-1, 1]) {
      const geometry = createFloorSideStripGeometry(
        contour, floor.userData.deckFootprint.centerZ, side, range.start, range.end
      );
      const fixture = lightingCore.addWallFixture(deck.id, {
        geometry,
        color: 0xeaf6ff,
        intensity: 1.15,
        name: `${deck.id}-Floor-Light-${side < 0 ? 'Port' : 'Starboard'}`
      });
      fixture.userData.floorStrip = {
        mount: 'floor',
        side: side < 0 ? 'port' : 'starboard',
        zStart: geometry.userData.floorRange.start,
        zEnd: geometry.userData.floorRange.end,
        edgeInset: 3.2,
        surfaceOffset: 0.025,
        collisionFree: true
      };
    }
  }
  lightingCore.group.userData.collisionBoxesAtInstall = collisionBoxes.length;

  // Console físico de acesso ao aplicativo Iluminação no Deck 1.
  const lightingConsole = createShipLightingConsole();
  group.add(lightingConsole.group);
  collisionBoxes.push(...lightingConsole.collisionBoxes);

  // D1 — ponte ampla, ocupando praticamente todo o primeiro deck.
  // A área central permanece livre para a única cadeira de comando,
  // que será adicionada em uma etapa posterior.
  {
    const y = STARSHIP_LAYOUT.decks[0].y + 2.65;
    // Laterais abertas: o contorno do casco passa a definir os limites da ponte.
    // Sem divisórias na ponte: o limite lateral é definido pelo casco.
    // Pequena antecâmara de acesso na popa, sem dividir a área principal.
    // Filete de soleira assentado no mesmo plano do piso, sem ressalto flutuante.
    addBox(group, [16, 0.035, 0.35], [0, STARSHIP_LAYOUT.decks[0].y + 0.2275, 40], trimMat, 'D1-Aft-Threshold');
  }

  // D2 — convés aberto. Piso, teto, casco e acesso técnico permanecem; divisórias removidas.

  // Núcleo vertical de Engenharia: bancada aberta no D2 e console no D3.
  // O conjunto não registra paredes nem caixas de colisão adicionais.
  const engineeringWarpCore = createEngineeringWarpCore();
  group.add(engineeringWarpCore);
  const dilithiumMatrix = createDilithiumMatrix();
  group.add(dilithiumMatrix);
  // Colisão compacta acompanha a instalação e o terminal, preservando o acesso lateral.
  collisionBoxes.push(
    { x: 2.3, y: -1.34, z: 5.3, halfX: 1.65, halfY: 1.35, halfZ: 1.65 },
    { x: 5.05, y: -2.02, z: 5.15, halfX: 0.65, halfY: 0.62, halfZ: 0.4 }
  );
  const dilithiumPlant = createDilithiumProcessingPlant();
  group.add(dilithiumPlant);
  const deflectorInterior = createDeflectorInteriorStructure();
  group.add(deflectorInterior);

  // D2 — uma única plataforma de transporte e um console físico dedicado.
  const transporterInstallation = createDeck2TransporterInstallation();
  group.add(transporterInstallation.group);
  collisionBoxes.push(...transporterInstallation.collisionBoxes);

  // D3 — convés aberto. Sem paredes ou anteparas internas.

  // D4 — hangar totalmente livre até a abertura externa.
  // Não criar molduras, travessas ou soleiras no corredor de saída:
  // as peças anteriores geravam caixas de colisão no acesso ao hangar.

  // Removidas as seis colunas externas: elas formavam a gaiola retangular ao redor do casco.

  return {
    group,
    dilithiumPlant,
    dilithiumMatrix,
    transporterInstallation,
    lightingConsole,
    lightingCore,
    layout: STARSHIP_LAYOUT,
    collisionBoxes,
    dispose() {
      group.traverse(object => {
        if (!object.isMesh) return;
        object.geometry?.dispose();
        if (Array.isArray(object.material)) object.material.forEach(m => m.dispose());
        else object.material?.dispose();
      });
      [floorMat, wallMat, bulkheadMat, trimMat, shaftMat].forEach(m => m.dispose());
    }
  };
}
