import * as THREE from 'three';

// Estação orbital Aurora: dois níveis habitáveis, ponte superior e alojamentos.
export function createStation(options = {}) {
  const {
    position = [24, 3, -65],
    scale = 1
  } = options;

  const group = new THREE.Group();
  group.position.set(...position);
  group.scale.setScalar(scale);

  const hull = new THREE.MeshStandardMaterial({
    color: 0x9aafbd,
    metalness: 0.72,
    roughness: 0.38
  });
  const structure = new THREE.MeshStandardMaterial({
    color: 0x344d61,
    metalness: 0.82,
    roughness: 0.32
  });
  const blue = new THREE.MeshStandardMaterial({
    color: 0x267da8,
    metalness: 0.65,
    roughness: 0.28
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x48c8ff,
    emissive: 0x0875a8,
    emissiveIntensity: 1.1,
    metalness: 0.35,
    roughness: 0.16
  });
  const warmGlass = new THREE.MeshStandardMaterial({
    color: 0xffc879,
    emissive: 0x9a4b12,
    emissiveIntensity: 0.8
  });

  const addBox = (parent, size, at, material, rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...size),
      material
    );
    mesh.position.set(...at);
    mesh.rotation.set(...rotation);
    parent.add(mesh);
    return mesh;
  };

  const addCylinder = (parent, radiusTop, radiusBottom, height, at, material, segments = 24) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
      material
    );
    mesh.position.set(...at);
    parent.add(mesh);
    return mesh;
  };

  // Anel externo e quatro braços estruturais.
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(10, 0.72, 12, 64),
    blue
  );
  group.add(ring);

  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2;
    const spoke = addBox(
      group,
      [0.65, 0.65, 8.7],
      [Math.cos(angle) * 4.8, Math.sin(angle) * 4.8, 0],
      structure
    );
    spoke.rotation.z = angle;
  }

  // Núcleo central pressurizado.
  addCylinder(group, 2.1, 2.1, 8.5, [0, 0, 0], structure, 32)
    .rotation.x = Math.PI / 2;

  // Dois andares habitáveis: alojamentos inferiores e área operacional superior.
  for (const level of [-1, 1]) {
    const deckY = level * 1.85;

    addBox(group, [7.4, 2.15, 6.2], [0, deckY, 0], hull);
    addBox(group, [7.8, 0.22, 6.5], [0, deckY + level * 1.08, 0], blue);

    // Fileiras de janelas nos dois lados do módulo.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        addBox(
          group,
          [0.12, 0.58, 0.9],
          [side * 3.77, deckY, -2.15 + i * 1.42],
          level > 0 ? glass : warmGlass
        );
      }
    }
  }

  // Ponte de comando no topo, com para-brisa voltado para a aproximação.
  const bridge = new THREE.Group();
  bridge.position.set(0, 4.15, -0.4);
  group.add(bridge);

  addBox(bridge, [4.8, 1.15, 3.5], [0, 0, 0], structure);
  const bridgeWindow = new THREE.Mesh(
    new THREE.BoxGeometry(4.1, 0.62, 0.12),
    glass
  );
  bridgeWindow.position.set(0, 0.05, -1.78);
  bridge.add(bridgeWindow);

  // Módulo de alojamentos / quarto na parte inferior.
  const quarters = new THREE.Group();
  quarters.position.set(0, -4.2, 0.5);
  group.add(quarters);

  addBox(quarters, [4.6, 1.1, 3.8], [0, 0, 0], structure);
  addBox(quarters, [3.5, 0.7, 0.12], [0, 0, -1.96], warmGlass);

  // Doca frontal, antenas e painéis solares laterais.
  addCylinder(group, 1.25, 1.55, 2.4, [0, 0, -6.0], blue, 20)
    .rotation.x = Math.PI / 2;
  addCylinder(group, 0.72, 0.72, 1.0, [0, 0, -7.55], hull, 20)
    .rotation.x = Math.PI / 2;

  for (const side of [-1, 1]) {
    addBox(group, [4.2, 0.12, 2.3], [side * 7.2, 0, 0.8], structure);
    addBox(group, [3.9, 0.06, 2.0], [side * 7.2, 0.12, 0.8], blue);

    const antenna = addCylinder(
      group, 0.08, 0.08, 2.4,
      [side * 4.5, 3.4, 2.8],
      hull, 8
    );
    antenna.rotation.z = side * 0.18;
  }

  const beacon = new THREE.PointLight(0x55cfff, 2.2, 28);
  beacon.position.set(0, 5.1, -1);
  group.add(beacon);

  return {
    group,
    dispose() {
      group.traverse(object => {
        if (!object.isMesh) return;
        object.geometry?.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material?.dispose();
        }
      });
      beacon.dispose();
    }
  };
}
