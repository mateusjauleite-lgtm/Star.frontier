// Modelo humanoide procedural do Star Frontier.
// Corpo-base separado do vestuário: roupas são grupos independentes e removíveis.
import * as THREE from 'three';

const material = (color, roughness = 0.78, metalness = 0.04) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

function mesh(parent, geometry, mat, position, name) {
  const object = new THREE.Mesh(geometry, mat);
  object.position.set(...position);
  object.name = name;
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function box(parent, size, mat, position, name, bevel = 0) {
  const geometry = bevel
    ? new THREE.BoxGeometry(...size, 2, 2, 2)
    : new THREE.BoxGeometry(...size);
  return mesh(parent, geometry, mat, position, name);
}

function sphere(parent, radius, mat, position, name, width = 20, height = 14) {
  return mesh(parent, new THREE.SphereGeometry(radius, width, height), mat, position, name);
}

function capsule(parent, radius, length, mat, position, name) {
  return mesh(parent, new THREE.CapsuleGeometry(radius, length, 8, 12), mat, position, name);
}

function limbPivot(parent, length, radius, mat, name) {
  const pivot = new THREE.Group();
  pivot.name = name;
  parent.add(pivot);
  capsule(pivot, radius, Math.max(0.02, length - radius * 2), mat,
    [0, -length * 0.5, 0], name + '-mesh');
  sphere(pivot, radius * 0.98, mat, [0, -length, 0], name + '-joint', 14, 10);
  return pivot;
}

function makeClothingGroup(parent, name) {
  const group = new THREE.Group();
  group.name = name;
  parent.add(group);
  return group;
}

/**
 * Personagem humano de aproximadamente 1,8 m.
 * Origem no chão, entre os pés; +Y para cima e -Z para a frente.
 *
 * O corpo não depende das roupas. wardrobe contém peças visuais independentes,
 * com IDs estáveis para futura ligação ao banco de itens/equipamentos.
 */
export function createCharacterModel(options = {}) {
  const scale = Number.isFinite(options.scale) ? options.scale : 1;
  const skinColor = options.skinColor ?? 0xc88963;
  const hairColor = options.hairColor ?? 0x30231e;

  const materials = {
    skin: material(skinColor, 0.88),
    hair: material(hairColor, 0.94),
    eyes: material(0x211b18, 0.3),
    shirt: material(0x344b5b, 0.9),
    jacket: material(options.clothingColor ?? 0x526879, 0.88),
    trousers: material(0x303b48, 0.92),
    boots: material(0x252a30, 0.72),
    fabricTrim: material(0x9aa9ad, 0.68),
    glove: material(0x343b40, 0.82),
    pack: material(0x46515a, 0.9)
  };

  const root = new THREE.Group();
  root.name = 'character-root';
  const rig = new THREE.Group();
  rig.name = 'character-rig';
  root.add(rig);

  const parts = {};
  const legGarments = [];
  const footGarments = [];
  const handGarments = [];

  // Pelve e tronco: volumes anatômicos arredondados, sem placas rígidas.
  parts.pelvis = new THREE.Group();
  parts.pelvis.name = 'pelvis';
  parts.pelvis.position.y = 0.91;
  rig.add(parts.pelvis);
  sphere(parts.pelvis, 0.185, materials.skin, [0, 0, 0], 'pelvis-body', 18, 12);

  parts.torso = new THREE.Group();
  parts.torso.name = 'torso';
  parts.torso.position.y = 0.08;
  parts.pelvis.add(parts.torso);
  capsule(parts.torso, 0.205, 0.28, materials.skin, [0, 0.205, 0], 'torso-body');
  sphere(parts.torso, 0.205, materials.skin, [0, 0.08, 0], 'abdomen-volume', 18, 12);

  // Roupa de base casual/de exploração: sem capacete e sem mochila obrigatórios.
  const wardrobe = {
    head: makeClothingGroup(parts.torso, 'wardrobe-head'),
    torso: makeClothingGroup(parts.torso, 'wardrobe-torso'),
    legs: makeClothingGroup(parts.pelvis, 'wardrobe-legs'),
    hands: makeClothingGroup(rig, 'wardrobe-hands'),
    feet: makeClothingGroup(rig, 'wardrobe-feet'),
    back: makeClothingGroup(parts.torso, 'wardrobe-back'),
    weapon: makeClothingGroup(rig, 'wardrobe-weapon')
  };

  // Cabeça, pescoço, rosto e cabelo.
  parts.neck = new THREE.Group();
  parts.neck.name = 'neck';
  parts.neck.position.set(0, 0.47, 0);
  parts.torso.add(parts.neck);
  capsule(parts.neck, 0.065, 0.09, materials.skin, [0, 0.015, 0], 'neck-body');

  parts.head = new THREE.Group();
  parts.head.name = 'head';
  parts.head.position.y = 0.13;
  parts.neck.add(parts.head);
  sphere(parts.head, 0.137, materials.skin, [0, 0.015, 0], 'head-face', 24, 18);
  // Nariz, orelhas, olhos e sobrancelhas dão leitura facial em escala de jogo.
  sphere(parts.head, 0.025, materials.skin, [0, -0.005, -0.128], 'nose', 12, 8);
  for (const side of [-1, 1]) {
    sphere(parts.head, 0.027, materials.skin, [side * 0.137, 0.015, 0], side < 0 ? 'left-ear' : 'right-ear', 12, 8);
    sphere(parts.head, 0.009, materials.eyes, [side * 0.052, 0.035, -0.126], side < 0 ? 'left-eye' : 'right-eye', 10, 8);
    box(parts.head, [0.035, 0.008, 0.008], materials.hair, [side * 0.052, 0.054, -0.127], side < 0 ? 'left-brow' : 'right-brow');
  }
  // Cabelo curto como parte estética do corpo; headwear continua sendo slot separado.
  sphere(parts.head, 0.139, materials.hair, [0, 0.085, 0.018], 'hair-cap', 20, 12);
  sphere(parts.head, 0.09, materials.hair, [0, 0.035, 0.095], 'rear-hair', 16, 10);

  // Ombros, braços e mãos articulados. Mantidos os nomes consumidos pelo animator.
  for (const side of [-1, 1]) {
    const prefix = side < 0 ? 'left' : 'right';
    const shoulder = new THREE.Group();
    shoulder.name = prefix + '-shoulder';
    shoulder.position.set(side * 0.235, 0.365, 0);
    parts.torso.add(shoulder);
    parts[prefix + 'Shoulder'] = shoulder;
    sphere(shoulder, 0.095, materials.skin, [0, 0, 0], prefix + '-shoulder-body', 16, 12);

    const upper = limbPivot(shoulder, 0.30, 0.078, materials.skin, prefix + '-upper-arm');
    upper.position.y = -0.045;
    parts[prefix + 'UpperArm'] = upper;

    const elbow = new THREE.Group();
    elbow.name = prefix + '-elbow';
    elbow.position.y = -0.30;
    upper.add(elbow);
    parts[prefix + 'Elbow'] = elbow;

    const forearm = limbPivot(elbow, 0.265, 0.066, materials.skin, prefix + '-forearm');
    parts[prefix + 'Forearm'] = forearm;

    const hand = new THREE.Group();
    hand.name = prefix + '-hand';
    hand.position.set(0, -0.275, -0.005);
    elbow.add(hand);
    sphere(hand, 0.055, materials.skin, [0, -0.02, 0], prefix + '-palm', 14, 10);
    for (let finger = 0; finger < 4; finger++) {
      capsule(hand, 0.012, 0.035, materials.skin,
        [(finger - 1.5) * 0.022, -0.067, -0.012], prefix + '-finger-' + finger);
    }
    capsule(hand, 0.013, 0.04, materials.skin, [side * -0.045, -0.035, -0.025], prefix + '-thumb');
    parts[prefix + 'Hand'] = hand;
  }

  // Quadris, coxas, joelhos, canelas, tornozelos e pés.
  for (const side of [-1, 1]) {
    const prefix = side < 0 ? 'left' : 'right';
    const hip = new THREE.Group();
    hip.name = prefix + '-hip';
    hip.position.set(side * 0.105, -0.075, 0);
    parts.pelvis.add(hip);
    parts[prefix + 'Hip'] = hip;

    const thigh = limbPivot(hip, 0.39, 0.095, materials.skin, prefix + '-thigh');
    parts[prefix + 'Thigh'] = thigh;

    const knee = new THREE.Group();
    knee.name = prefix + '-knee';
    knee.position.y = -0.39;
    thigh.add(knee);
    sphere(knee, 0.079, materials.skin, [0, -0.005, 0], prefix + '-knee-body', 14, 10);
    parts[prefix + 'Knee'] = knee;

    const shin = limbPivot(knee, 0.365, 0.072, materials.skin, prefix + '-shin');
    parts[prefix + 'Shin'] = shin;

    const ankle = new THREE.Group();
    ankle.name = prefix + '-ankle';
    ankle.position.y = -0.365;
    shin.add(ankle);
    sphere(ankle, 0.065, materials.skin, [0, -0.015, 0], prefix + '-ankle-body', 12, 8);
    parts[prefix + 'Ankle'] = ankle;
  }

  // Peças adicionais para testar o sistema modular de equipamento.
  const helmetMat = material(0x607b8b, 0.38, 0.42);
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x69dfff, roughness: 0.22, metalness: 0.55, transparent: true, opacity: 0.72 });
  sphere(wardrobe.head, 0.151, helmetMat, [0, 0.72, 0.005], 'explorer-helmet-shell', 20, 14);
  box(wardrobe.head, [0.22, 0.055, 0.16], helmetMat, [0, 0.665, -0.012], 'explorer-helmet-rim');
  sphere(wardrobe.head, 0.105, visorMat, [0, 0.705, -0.105], 'explorer-helmet-visor', 18, 12);
  for (const side of [-1, 1]) {
    const hand = parts[side < 0 ? 'leftHand' : 'rightHand'];
    const glove = new THREE.Group();
    glove.name = (side < 0 ? 'left' : 'right') + '-glove';
    hand.add(glove);
    handGarments.push(glove);
    sphere(glove, 0.058, materials.glove, [0, -0.018, 0], 'glove-palm', 14, 10);
    for (let finger = 0; finger < 4; finger++) {
      capsule(glove, 0.013, 0.04, materials.glove,
        [(finger - 1.5) * 0.022, -0.067, -0.012], 'glove-finger-' + finger);
    }
  }
  box(wardrobe.back, [0.29, 0.38, 0.14], materials.pack, [0, 0.22, 0.205], 'explorer-backpack');
  box(wardrobe.back, [0.20, 0.12, 0.035], materials.fabricTrim, [0, 0.18, 0.285], 'backpack-panel');

  // Phaser procedural, preso à mão direita para acompanhar o rig e as animações.
  const phaserBody = material(0x354956, 0.32, 0.72);
  const phaserMetal = material(0x9bb4c1, 0.28, 0.82);
  const phaserEnergy = new THREE.MeshStandardMaterial({ color: 0x55dcff, emissive: 0x168eb8, emissiveIntensity: 1.8, metalness: 0.35, roughness: 0.2 });
  const phaserHand = parts.rightHand;
  const phaser = new THREE.Group();
  phaser.name = 'phaser-weapon';
  phaser.position.set(0, -0.035, -0.105);
  phaser.rotation.x = -0.08;
  wardrobe.weapon.add(phaser);
  // Empunhadura e corpo apontam para a frente do personagem (-Z).
  box(phaser, [0.075, 0.105, 0.25], phaserBody, [0, 0.005, -0.055], 'phaser-frame');
  box(phaser, [0.052, 0.13, 0.085], phaserBody, [0, -0.105, 0.015], 'phaser-grip');
  box(phaser, [0.09, 0.035, 0.12], phaserMetal, [0, 0.066, -0.055], 'phaser-top-rail');
  const emitter = new THREE.Group();
  emitter.position.set(0, 0.005, -0.19);
  phaser.add(emitter);
  sphere(emitter, 0.035, phaserEnergy, [0, 0, 0], 'phaser-emitter', 14, 10);
  const muzzle = new THREE.PointLight(0x49dfff, 0, 1.6, 2);
  muzzle.position.set(0, 0, -0.22);
  phaser.add(muzzle);
  phaser.userData.muzzleLight = muzzle;
  phaser.userData.energyMaterial = phaserEnergy;
  // A arma é anexada ao grupo da mão, não à tela/HUD.
  phaserHand.add(wardrobe.weapon);
  wardrobe.weapon.visible = false;

  // Vestuário inicial independente: jaqueta leve, calça e botas.
  // Nenhuma peça cobre a cabeça; luvas e mochila começam desequipadas.
  const torsoClothes = wardrobe.torso;
  capsule(torsoClothes, 0.214, 0.30, materials.shirt, [0, 0.205, -0.002], 'base-shirt');
  capsule(torsoClothes, 0.222, 0.31, materials.jacket, [0, 0.215, -0.006], 'field-jacket');
  box(torsoClothes, [0.012, 0.25, 0.012], materials.fabricTrim, [0, 0.21, -0.216], 'jacket-seam');
  for (let i = 0; i < 3; i++) sphere(torsoClothes, 0.009, materials.fabricTrim,
    [0, 0.29 - i * 0.075, -0.222], 'jacket-button-' + i, 8, 6);

  for (const side of [-1, 1]) {
    const prefix = side < 0 ? 'left' : 'right';
    const hip = parts[prefix + 'Hip'];
    const thighCloth = makeClothingGroup(hip, prefix + '-trouser-leg');
    // A peça acompanha o pivô da coxa e preserva as articulações existentes.
    legGarments.push(thighCloth);
    capsule(thighCloth, 0.101, 0.34, materials.trousers, [0, -0.19, 0], prefix + '-trousers');
    const kneeCloth = makeClothingGroup(parts[prefix + 'Knee'], prefix + '-trouser-knee');
    legGarments.push(kneeCloth);
    sphere(kneeCloth, 0.086, materials.trousers, [0, -0.012, 0], prefix + '-trouser-knee-cover', 16, 12);
    const shinCloth = makeClothingGroup(parts[prefix + 'Knee'], prefix + '-trouser-shin');
    legGarments.push(shinCloth);
    capsule(shinCloth, 0.078, 0.31, materials.trousers, [0, -0.17, 0], prefix + '-lower-trousers');
    // Mantém cada peça no pivô da articulação para acompanhar a animação.

    const boot = makeClothingGroup(parts[prefix + 'Ankle'], prefix + '-boot-item');
    footGarments.push(boot);
    box(boot, [0.14, 0.12, 0.24], materials.boots, [0, -0.025, -0.035], prefix + '-boot-shoe');
    box(boot, [0.145, 0.025, 0.245], materials.fabricTrim, [0, -0.087, -0.035], prefix + '-boot-sole');
    // A bota permanece filha do tornozelo para acompanhar a passada.
  }

  const defaultEquipment = {
    head: null,
    torso: 'clothing.field-jacket',
    legs: 'clothing.utility-trousers',
    hands: null,
    feet: 'clothing.exploration-boots',
    back: null
  };

  const wardrobeState = { ...defaultEquipment };
  const slotGroups = {
    head: [wardrobe.head],
    torso: [wardrobe.torso],
    legs: legGarments,
    hands: [wardrobe.hands, ...handGarments],
    feet: footGarments,
    back: [wardrobe.back],
    weapon: [wardrobe.weapon]
  };

  function setEquipment(slot, itemId) {
    if (!Object.hasOwn(slotGroups, slot)) {
      throw new TypeError('Espaço de vestuário desconhecido: ' + slot);
    }
    wardrobeState[slot] = itemId ?? null;
    const equipped = wardrobeState[slot] !== null;
    for (const group of slotGroups[slot]) group.visible = equipped;
    return { ...wardrobeState };
  }

  function getEquipment() {
    return { ...wardrobeState };
  }

  // Slots começam com o conjunto padrão definido acima.
  for (const slot of Object.keys(slotGroups)) {
    for (const group of slotGroups[slot]) {
      group.visible = wardrobeState[slot] !== null;
    }
  }

  root.scale.setScalar(scale);
  root.userData.characterType = 'humanoid-explorer';
  root.userData.height = 1.8 * scale;
  root.userData.parts = parts;
  root.userData.materials = materials;
  root.userData.wardrobe = wardrobe;
  root.userData.equipment = getEquipment;

  return {
    group: root, rig, parts, materials, wardrobe,
    setEquipment, getEquipment, defaultEquipment: { ...defaultEquipment }
  };
}
