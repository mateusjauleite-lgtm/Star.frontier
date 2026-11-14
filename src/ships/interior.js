import * as THREE from 'three';

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
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0x536b7d, metalness: 0.65, roughness: 0.52,
    transparent: true, opacity: 0.22, depthWrite: false,
    side: THREE.DoubleSide
  });
  const trimMat = new THREE.MeshBasicMaterial({ color: 0x39bce8 });
  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0x172737, metalness: 0.7, roughness: 0.55
  });
  const collisionBoxes = [];

  const addBox = (parent, size, at, material, name = '') => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...at);
    if (name) mesh.name = name;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    parent.add(mesh);
    if (/Wall|Partition|Bulkhead|Frame/.test(name)) {
      collisionBoxes.push({
        x: mesh.position.x, y: mesh.position.y, z: mesh.position.z,
        halfX: size[0] / 2, halfY: size[1] / 2, halfZ: size[2] / 2
      });
    }
    return mesh;
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

  const addDeckPlate = (y, width, length, material, name, thickness) => {
    // Planta elíptica acompanha o casco arredondado, sem criar uma moldura retangular.
    const shape = new THREE.Shape();
    shape.absellipse(0, 0, width / 2, length / 2, 0, Math.PI * 2, false, 0);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness, bevelEnabled: false, curveSegments: 48
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(0, y + thickness / 2, -2);
    mesh.name = name;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  const deckFloor = (deck, label) => {
    const y = deck.y;
    const footprints = {
      D1: [50, 82], D2: [50, 94], D3: [53, 102], D4: [35, 58]
    };
    const [width, length] = footprints[deck.id];
    addDeckPlate(y, width, length, floorMat, label + '-Floor', 0.42);
    // Acesso técnico permanece marcado no piso, dentro da área útil.
    addBox(group, [5.8, 0.035, 5.8], [0, y + 0.23, 25], shaftMat, label + '-Reserved-Vertical-Access');
    addDeckPlate(y + 5.35, width, length, ceilingMat, label + '-Ceiling', 0.22);
  };

  for (const deck of STARSHIP_LAYOUT.decks) {
    deckFloor(deck, deck.id);
  }

  // D1 — ponte ampla, ocupando praticamente todo o primeiro deck.
  // A área central permanece livre para a única cadeira de comando,
  // que será adicionada em uma etapa posterior.
  {
    const y = STARSHIP_LAYOUT.decks[0].y + 2.65;
    // Laterais abertas: o contorno do casco passa a definir os limites da ponte.
    doorwayWallX(0, y, 38.5, 48, 5.25, 0.55, 5.2, 3.1);
    // Pequena antecâmara de acesso na popa, sem dividir a área principal.
    // Filete de soleira assentado no mesmo plano do piso, sem ressalto flutuante.
    addBox(group, [16, 0.035, 0.35], [0, STARSHIP_LAYOUT.decks[0].y + 0.2275, 40], trimMat, 'D1-Aft-Threshold');
  }

  // D2 — corredor longitudinal central e compartimentos independentes.
  {
    const y = STARSHIP_LAYOUT.decks[1].y + 2.65;
    for (const z of [-30, -9, 12, 33]) {
      doorwayWallZ(-3.8, y, z, 17, 5.25, 0.45, 2.6, 2.9);
      doorwayWallZ(3.8, y, z, 17, 5.25, 0.45, 2.6, 2.9);
    }
    // Fechamentos entre os vãos de porta, preservando a continuidade do corredor.
    // A passagem do elevador em D2 ocupa o trecho central ao redor de
    // (x: 0, z: 25). Os segmentos laterais desse trecho foram removidos
    // para manter a escotilha e sua área de acesso livres.
    for (const z of [-41, -19.5, 1.5, 43.5]) {
      addBox(group, [0.45, 5.25, 4], [-3.8, y, z], wallMat, 'D2-Corridor-Port-Wall');
      addBox(group, [0.45, 5.25, 4], [3.8, y, z], wallMat, 'D2-Corridor-Starboard-Wall');
    }
    // Anteparas transversais entre salas; as portas ficam voltadas ao corredor.
    for (const z of [-19.5, 1.5, 22.5]) {
      addBox(group, [18, 5.25, 0.38], [-15.2, y, z], wallMat, 'D2-Port-Compartment-Partition');
      addBox(group, [18, 5.25, 0.38], [15.2, y, z], wallMat, 'D2-Starboard-Compartment-Partition');
    }
    doorwayWallZ(0, y, 41.2, 53, 5.25, 0.55, 5.2, 3.1);
  }

  // D3 — salão técnico amplo, com salas laterais e corredor de serviço.
  {
    const y = STARSHIP_LAYOUT.decks[2].y + 2.65;
    for (const z of [-28, -5, 18, 41]) {
      doorwayWallZ(-18.5, y, z, 17, 5.25, 0.45, 2.4, 2.9);
      doorwayWallZ(18.5, y, z, 17, 5.25, 0.45, 2.4, 2.9);
    }
    // Trechos de antepara entre os vãos de acesso aos compartimentos.
    for (const z of [-39.75, -16.5, 6.5, 29.5]) {
      const segmentLength = z === -39.75 ? 6.5 : 6;
      addBox(group, [0.45, 5.25, segmentLength], [-18.5, y, z], wallMat, 'D3-Port-Service-Wall');
      addBox(group, [0.45, 5.25, segmentLength], [18.5, y, z], wallMat, 'D3-Starboard-Service-Wall');
    }
    // Divisórias internas dos compartimentos laterais.
    for (const z of [-16.5, 6.5, 29.5]) {
      addBox(group, [8, 5.25, 0.38], [-22.5, y, z], wallMat, 'D3-Port-Aft-Partition');
      addBox(group, [8, 5.25, 0.38], [22.5, y, z], wallMat, 'D3-Starboard-Aft-Partition');
    }
    doorwayWallX(0, y, 49.2, 53, 5.25, 0.55, 5.2, 3.1);
  }

  // D4 — hangar central amplo, com acesso de carga reservado na popa.
  // A largura e o formato da abertura externa serão definidos depois.
  {
    const y = STARSHIP_LAYOUT.decks[3].y + 2.65;
    // Hangar sem paredes laterais externas: mantém o centro amplo e aberto.
    // Hangar livre de divisórias periféricas que ultrapassavam o novo contorno.
    // Antepara frontal e moldura traseira dimensionadas para o deck reduzido.
    addBox(group, [30, 5.25, 0.55], [0, y, -28.5], bulkheadMat, 'D4-Hangar-Forward-Bulkhead');
    const doorWidth = 16;
    const doorHeight = 4.2;
    const sideWidth = (35 - doorWidth) / 2;
    const aftZ = 26.5;
    addBox(group, [sideWidth, 5.25, 0.75], [-(doorWidth / 2 + sideWidth / 2), y, aftZ], bulkheadMat, 'D4-Aft-Door-Port-Frame');
    addBox(group, [sideWidth, 5.25, 0.75], [(doorWidth / 2 + sideWidth / 2), y, aftZ], bulkheadMat, 'D4-Aft-Door-Starboard-Frame');
    addBox(group, [doorWidth, (5.25 - doorHeight) / 2, 0.75], [0, y + (doorHeight + 5.25) / 4, aftZ], bulkheadMat, 'D4-Aft-Door-Header');
    addBox(group, [doorWidth, 0.28, 0.75], [0, y - 2.48, aftZ], trimMat, 'D4-Hangar-Door-Threshold');
  }

  // Removidas as seis colunas externas: elas formavam a gaiola retangular ao redor do casco.

  return {
    group,
    layout: STARSHIP_LAYOUT,
    collisionBoxes,
    dispose() {
      group.traverse(object => {
        if (!object.isMesh) return;
        object.geometry?.dispose();
        if (Array.isArray(object.material)) object.material.forEach(m => m.dispose());
        else object.material?.dispose();
      });
      [floorMat, wallMat, bulkheadMat, ceilingMat, trimMat, shaftMat].forEach(m => m.dispose());
    }
  };
}
