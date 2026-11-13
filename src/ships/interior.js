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
  const position = options.position || [-70, 0, -105];
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

  const addBox = (parent, size, at, material, name = '') => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...at);
    if (name) mesh.name = name;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // Parede com vão central para futura instalação de porta.
  const doorwayWallX = (x, y, z, length, height, thickness, doorWidth = 2.4, doorHeight = 2.8) => {
    const side = (length - doorWidth) / 2;
    addBox(group, [side, height, thickness], [x - doorWidth / 2 - side / 2, y, z], wallMat, 'Wall-Door-Left');
    addBox(group, [side, height, thickness], [x + doorWidth / 2 + side / 2, y, z], wallMat, 'Wall-Door-Right');
    addBox(group, [doorWidth, height - doorHeight, thickness], [x, y + (height + doorHeight) / 2, z], bulkheadMat, 'Wall-Door-Header');
  };

  const doorwayWallZ = (x, y, z, length, height, thickness, doorWidth = 2.4, doorHeight = 2.8) => {
    const side = (length - doorWidth) / 2;
    addBox(group, [thickness, height, side], [x, y, z - doorWidth / 2 - side / 2], wallMat, 'Wall-Door-Left');
    addBox(group, [thickness, height, side], [x, y, z + doorWidth / 2 + side / 2], wallMat, 'Wall-Door-Right');
    addBox(group, [thickness, height - doorHeight, doorWidth], [x, y + (height + doorHeight) / 2, z], bulkheadMat, 'Wall-Door-Header');
  };

  const deckFloor = (deck, label) => {
    const y = deck.y;
    addBox(group, [54, 0.42, 100], [0, y, 0], floorMat, label + '-Floor');
    // Abertura técnica apenas demarcada: o vão será recortado quando
    // o sistema vertical de transporte for implementado.
    addBox(group, [5.8, 0.035, 5.8], [0, y + 0.23, 34], shaftMat, label + '-Reserved-Vertical-Access');
    addBox(group, [54, 0.22, 100], [0, y + 5.35, 0], ceilingMat, label + '-Ceiling');
    // Reforços estruturais laterais.
    addBox(group, [0.7, 5.25, 100], [-27.2, y + 2.75, 0], bulkheadMat, label + '-Port-Bulkhead');
    addBox(group, [0.7, 5.25, 100], [27.2, y + 2.75, 0], bulkheadMat, label + '-Starboard-Bulkhead');
  };

  for (const deck of STARSHIP_LAYOUT.decks) {
    deckFloor(deck, deck.id);
  }

  // D1 — ponte ampla, ocupando praticamente todo o primeiro deck.
  // A área central permanece livre para a única cadeira de comando,
  // que será adicionada em uma etapa posterior.
  {
    const y = STARSHIP_LAYOUT.decks[0].y + 2.65;
    addBox(group, [0.45, 5.25, 100], [-26.5, y, 0], wallMat, 'D1-Port-Inner-Wall');
    addBox(group, [0.45, 5.25, 100], [26.5, y, 0], wallMat, 'D1-Starboard-Inner-Wall');
    doorwayWallX(0, y, 49.2, 53, 5.25, 0.55, 5.2, 3.1);
    // Pequena antecâmara de acesso na popa, sem dividir a área principal.
    addBox(group, [16, 0.22, 0.35], [0, STARSHIP_LAYOUT.decks[0].y + 0.5, 40], trimMat, 'D1-Aft-Threshold');
  }

  // D2 — corredor longitudinal central e compartimentos independentes.
  {
    const y = STARSHIP_LAYOUT.decks[1].y + 2.65;
    addBox(group, [0.45, 5.25, 82], [-3.8, y, 0], wallMat, 'D2-Corridor-Port-Wall');
    addBox(group, [0.45, 5.25, 82], [3.8, y, 0], wallMat, 'D2-Corridor-Starboard-Wall');
    for (const z of [-30, -9, 12, 33]) {
      doorwayWallZ(-3.8, y, z, 17, 5.25, 0.45, 2.6, 2.9);
      doorwayWallZ(3.8, y, z, 17, 5.25, 0.45, 2.6, 2.9);
    }
    // Anteparas transversais entre salas; as portas ficam voltadas ao corredor.
    for (const z of [-19.5, 1.5, 22.5]) {
      addBox(group, [18, 5.25, 0.38], [-15.2, y, z], wallMat, 'D2-Port-Compartment-Partition');
      addBox(group, [18, 5.25, 0.38], [15.2, y, z], wallMat, 'D2-Starboard-Compartment-Partition');
    }
    doorwayWallZ(0, y, 49.2, 53, 5.25, 0.55, 5.2, 3.1);
  }

  // D3 — salão técnico amplo, com salas laterais e corredor de serviço.
  {
    const y = STARSHIP_LAYOUT.decks[2].y + 2.65;
    addBox(group, [0.45, 5.25, 88], [-18.5, y, 0], wallMat, 'D3-Port-Service-Wall');
    addBox(group, [0.45, 5.25, 88], [18.5, y, 0], wallMat, 'D3-Starboard-Service-Wall');
    for (const z of [-28, -5, 18, 41]) {
      doorwayWallZ(-18.5, y, z, 17, 5.25, 0.45, 2.4, 2.9);
      doorwayWallZ(18.5, y, z, 17, 5.25, 0.45, 2.4, 2.9);
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
    addBox(group, [0.45, 5.25, 82], [-20.5, y, 0], wallMat, 'D4-Hangar-Port-Wall');
    addBox(group, [0.45, 5.25, 82], [20.5, y, 0], wallMat, 'D4-Hangar-Starboard-Wall');
    // Compartimentos de apoio nas laterais, mantendo o centro livre.
    addBox(group, [10, 5.25, 0.4], [-25, y, -26], wallMat, 'D4-Port-Support-Partition');
    addBox(group, [10, 5.25, 0.4], [25, y, -26], wallMat, 'D4-Starboard-Support-Partition');
    addBox(group, [10, 5.25, 0.4], [-25, y, 23], wallMat, 'D4-Port-Aft-Partition');
    addBox(group, [10, 5.25, 0.4], [25, y, 23], wallMat, 'D4-Starboard-Aft-Partition');
    // Parede de proa; a popa fica aberta para a futura porta do hangar.
    addBox(group, [54, 5.25, 0.55], [0, y, -49.2], bulkheadMat, 'D4-Hangar-Forward-Bulkhead');
    addBox(group, [10, 5.25, 0.55], [-22, y, 49.2], bulkheadMat, 'D4-Aft-Port-Pillar');
    addBox(group, [10, 5.25, 0.55], [22, y, 49.2], bulkheadMat, 'D4-Aft-Starboard-Pillar');
  }

  // Travessas externas que amarram os quatro níveis sem ocupar os corredores.
  for (const x of [-26.2, 26.2]) {
    for (const z of [-46, 0, 46]) {
      addBox(group, [0.8, 31, 0.8], [x, 0, z], bulkheadMat, 'Hull-Structural-Column');
    }
  }

  return {
    group,
    layout: STARSHIP_LAYOUT,
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
