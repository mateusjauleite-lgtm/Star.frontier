import * as THREE from 'three';

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

  const addMesh = (geometry, material, position, scale = [1, 1, 1], name = '') => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    if (name) mesh.name = name;
    visual.add(mesh);
    return mesh;
  };

  // Casco em duas conchas: seção superior e inferior, envolvendo os quatro decks.
  const upperHull = addMesh(
    new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2),
    hullMaterial, [0, 0, 0], [27.2, 15.2, 50], 'Upper-Saucer-Hull'
  );
  const lowerHull = addMesh(
    new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    undersideMaterial, [0, 0, 0], [27.2, 15.2, 50], 'Lower-Saucer-Hull'
  );

  // Reforço dorsal e casco de engenharia inferior.
  addMesh(new THREE.SphereGeometry(1, 32, 20), trimMaterial,
    [0, 12.2, -30], [6.2, 2.1, 8.5], 'Bridge-Dorsal-Dome');
  addMesh(new THREE.SphereGeometry(1, 36, 24), undersideMaterial,
    [0, -10.2, 18], [11.5, 4.8, 25], 'Engineering-Secondary-Hull');

  const engineFlames = [];
  const engineLights = [];

  for (const side of [-1, 1]) {
    // Pilares laterais conectam o casco às nacelles.
    const pylon = addMesh(
      new THREE.BoxGeometry(5.5, 13, 19),
      undersideMaterial,
      [side * 24, -2.2, 12],
      [1, 1, 1],
      side < 0 ? 'Port-Nacelle-Pylon' : 'Starboard-Nacelle-Pylon'
    );
    pylon.rotation.z = side * -0.22;

    const nacelle = new THREE.Group();
    nacelle.name = side < 0 ? 'Port-Warp-Nacelle' : 'Starboard-Warp-Nacelle';
    nacelle.position.set(side * 37, 1.2, 10);
    visual.add(nacelle);

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(3.1, 3.7, 72, 24),
      undersideMaterial
    );
    body.rotation.x = Math.PI / 2;
    nacelle.add(body);

    const forwardCap = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 20, 14),
      trimMaterial
    );
    forwardCap.position.z = -35.5;
    forwardCap.scale.set(1, 1, 0.35);
    nacelle.add(forwardCap);

    const bussard = new THREE.Mesh(
      new THREE.SphereGeometry(2.25, 20, 14),
      glowMaterial
    );
    bussard.position.z = -36.2;
    bussard.scale.z = 0.42;
    nacelle.add(bussard);

    const aftRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.05, 0.42, 10, 28),
      trimMaterial
    );
    aftRing.position.z = 35.7;
    nacelle.add(aftRing);

    const engineCore = new THREE.Mesh(
      new THREE.SphereGeometry(2.45, 20, 14),
      glowMaterial
    );
    engineCore.position.z = 36.2;
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

  return { group, yaw, pitch, visual, engineFlames, engineLights };
}
