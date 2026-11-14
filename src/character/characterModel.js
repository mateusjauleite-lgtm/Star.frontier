// Modelo humanoide procedural do Star Frontier.
// Estrutura independente da cena principal: pode ser anexada a qualquer nave,
// estação ou ambiente sem alterar o sistema de pilotagem.
import * as THREE from 'three';

const makeMaterial = (color, metalness = 0.25, roughness = 0.62) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness });

function addBox(parent, size, material, position, name) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addSphere(parent, radius, material, position, name, segments = 16) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, segments, Math.max(8, segments >> 1)),
    material
  );
  mesh.position.set(...position);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addLimb(parent, length, width, material, name) {
  const pivot = new THREE.Group();
  pivot.name = name;
  parent.add(pivot);

  const limb = addBox(
    pivot,
    [width, length, width],
    material,
    [0, -length * 0.5, 0],
    name + '-mesh'
  );
  addSphere(pivot, width * 0.53, material, [0, -length, 0], name + '-joint', 12);
  return pivot;
}

/**
 * Cria um personagem humanoide de aproximadamente 1,8 m.
 * A origem fica no chão, no centro dos pés; +Y é para cima e -Z é a frente.
 */
export function createCharacterModel(options = {}) {
  const scale = Number.isFinite(options.scale) ? options.scale : 1;
  const suitColor = options.suitColor ?? 0x263b50;
  const accentColor = options.accentColor ?? 0x36c9df;

  const materials = {
    suit: makeMaterial(suitColor, 0.32, 0.58),
    dark: makeMaterial(0x101b28, 0.42, 0.5),
    armor: makeMaterial(0x9aabb9, 0.62, 0.34),
    accent: makeMaterial(accentColor, 0.48, 0.3),
    visor: new THREE.MeshStandardMaterial({
      color: 0x071b2c,
      metalness: 0.82,
      roughness: 0.16,
      emissive: 0x06283a,
      emissiveIntensity: 0.35
    }),
    glove: makeMaterial(0x17232e, 0.18, 0.72)
  };

  const root = new THREE.Group();
  root.name = 'character-root';

  const rig = new THREE.Group();
  rig.name = 'character-rig';
  root.add(rig);

  const parts = {};

  // Bacia e tronco.
  parts.pelvis = new THREE.Group();
  parts.pelvis.name = 'pelvis';
  parts.pelvis.position.y = 0.91;
  rig.add(parts.pelvis);

  addBox(parts.pelvis, [0.34, 0.22, 0.22], materials.dark, [0, 0, 0], 'pelvis-shell');

  parts.torso = new THREE.Group();
  parts.torso.name = 'torso';
  parts.torso.position.y = 0.08;
  parts.pelvis.add(parts.torso);

  addBox(parts.torso, [0.43, 0.48, 0.25], materials.suit, [0, 0.22, 0], 'torso-shell');
  addBox(parts.torso, [0.34, 0.13, 0.275], materials.armor, [0, 0.39, -0.005], 'chest-plate');
  addBox(parts.torso, [0.12, 0.07, 0.286], materials.accent, [0, 0.39, -0.012], 'chest-insignia');
  addBox(parts.torso, [0.18, 0.13, 0.16], materials.dark, [0, 0.04, 0.17], 'life-support-control');

  // Mochila de suporte de vida.
  parts.backpack = new THREE.Group();
  parts.backpack.name = 'life-support-pack';
  parts.backpack.position.set(0, 0.27, 0.19);
  parts.torso.add(parts.backpack);
  addBox(parts.backpack, [0.29, 0.38, 0.16], materials.dark, [0, 0, 0], 'backpack-shell');
  addBox(parts.backpack, [0.22, 0.08, 0.18], materials.accent, [0, 0.12, 0], 'backpack-status');
  addBox(parts.backpack, [0.08, 0.2, 0.08], materials.armor, [-0.19, -0.02, 0], 'left-canister');
  addBox(parts.backpack, [0.08, 0.2, 0.08], materials.armor, [0.19, -0.02, 0], 'right-canister');

  // Pescoço, cabeça e visor.
  parts.neck = new THREE.Group();
  parts.neck.name = 'neck';
  parts.neck.position.set(0, 0.49, 0);
  parts.torso.add(parts.neck);
  addBox(parts.neck, [0.12, 0.12, 0.12], materials.dark, [0, 0.02, 0], 'neck-joint');

  parts.head = new THREE.Group();
  parts.head.name = 'head';
  parts.head.position.y = 0.13;
  parts.neck.add(parts.head);
  addSphere(parts.head, 0.145, materials.suit, [0, 0.015, 0], 'helmet-shell', 20);
  addBox(parts.head, [0.205, 0.105, 0.075], materials.visor, [0, 0.025, -0.105], 'helmet-visor');
  addBox(parts.head, [0.22, 0.025, 0.08], materials.armor, [0, 0.092, -0.075], 'helmet-brow');
  addSphere(parts.head, 0.025, materials.accent, [0.13, 0.02, 0], 'helmet-side-light', 10);
  addSphere(parts.head, 0.025, materials.accent, [-0.13, 0.02, 0], 'helmet-side-light-left', 10);

  // Ombros, braços articulados, antebraços e luvas.
  for (const side of [-1, 1]) {
    const prefix = side < 0 ? 'left' : 'right';
    const shoulder = new THREE.Group();
    shoulder.name = prefix + '-shoulder';
    shoulder.position.set(side * 0.255, 0.39, 0);
    parts.torso.add(shoulder);
    parts[prefix + 'Shoulder'] = shoulder;

    addSphere(shoulder, 0.105, materials.armor, [0, 0, 0], prefix + '-shoulder-pad');
    const upper = addLimb(shoulder, 0.31, 0.115, materials.suit, prefix + '-upper-arm');
    upper.position.y = -0.055;
    parts[prefix + 'UpperArm'] = upper;

    const elbow = new THREE.Group();
    elbow.name = prefix + '-elbow';
    elbow.position.y = -0.31;
    upper.add(elbow);
    parts[prefix + 'Elbow'] = elbow;

    const forearm = addLimb(elbow, 0.27, 0.095, materials.armor, prefix + '-forearm');
    parts[prefix + 'Forearm'] = forearm;

    const hand = new THREE.Group();
    hand.name = prefix + '-hand';
    hand.position.y = -0.29;
    elbow.add(hand);
    addBox(hand, [0.105, 0.105, 0.12], materials.glove, [0, -0.025, -0.005], prefix + '-glove');
    parts[prefix + 'Hand'] = hand;
  }

  // Pernas com quadril, joelho e tornozelo independentes.
  for (const side of [-1, 1]) {
    const prefix = side < 0 ? 'left' : 'right';
    const hip = new THREE.Group();
    hip.name = prefix + '-hip';
    hip.position.set(side * 0.115, -0.08, 0);
    parts.pelvis.add(hip);
    parts[prefix + 'Hip'] = hip;

    const thigh = addLimb(hip, 0.39, 0.145, materials.suit, prefix + '-thigh');
    parts[prefix + 'Thigh'] = thigh;

    const knee = new THREE.Group();
    knee.name = prefix + '-knee';
    knee.position.y = -0.39;
    thigh.add(knee);
    addBox(knee, [0.15, 0.12, 0.17], materials.armor, [0, -0.015, -0.005], prefix + '-knee-plate');
    parts[prefix + 'Knee'] = knee;

    const shin = addLimb(knee, 0.37, 0.115, materials.suit, prefix + '-shin');
    parts[prefix + 'Shin'] = shin;

    const ankle = new THREE.Group();
    ankle.name = prefix + '-ankle';
    ankle.position.y = -0.37;
    shin.add(ankle);
    addBox(ankle, [0.14, 0.12, 0.23], materials.dark, [0, -0.02, -0.035], prefix + '-boot');
    addBox(ankle, [0.145, 0.035, 0.24], materials.accent, [0, -0.075, -0.035], prefix + '-boot-sole');
    parts[prefix + 'Ankle'] = ankle;
  }

  // Pequenos detalhes luminosos no traje.
  addBox(parts.torso, [0.045, 0.12, 0.025], materials.accent, [-0.16, 0.19, -0.135], 'left-chest-light');
  addBox(parts.torso, [0.045, 0.12, 0.025], materials.accent, [0.16, 0.19, -0.135], 'right-chest-light');

  root.scale.setScalar(scale);
  root.userData.characterType = 'humanoid-explorer';
  root.userData.height = 1.8 * scale;
  root.userData.parts = parts;
  root.userData.materials = materials;

  return { group: root, rig, parts, materials };
}
