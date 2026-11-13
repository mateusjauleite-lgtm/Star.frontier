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

  // Popa redesenhada: corpo de engenharia afunilado, hangar central
  // recuado e suportes curvos integrados ao casco, sem travessa retangular.
  addMesh(new THREE.SphereGeometry(1, 32, 20), undersideMaterial,
    [0, -7.2, 39], [9.2, 4.2, 15], 'Integrated-Aft-Engineering-Pod');

  // Boca do hangar central: abertura escura recuada, sem moldura em caixa.
  addMesh(new THREE.BoxGeometry(13.5, 4.8, 0.22), undersideMaterial,
    [0, -7.1, 54.2], [1, 1, 1], 'Central-Aft-Hangar-Recess');
  addMesh(new THREE.BoxGeometry(13.9, 0.32, 0.42), trimMaterial,
    [0, -4.55, 53.95], [1, 1, 1], 'Central-Hangar-Upper-Lip');
  addMesh(new THREE.BoxGeometry(13.9, 0.32, 0.42), trimMaterial,
    [0, -9.65, 53.95], [1, 1, 1], 'Central-Hangar-Lower-Lip');

  for (const side of [-1, 1]) {
    const supportCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 7.5, -8.2, 37),
      new THREE.Vector3(side * 9.5, -4.2, 43),
      new THREE.Vector3(side * 11.5, -0.8, 51),
      new THREE.Vector3(side * 12.2, 0.1, 56)
    ]);
    const support = new THREE.Mesh(
      new THREE.TubeGeometry(supportCurve, 24, 2.0, 12, false),
      undersideMaterial
    );
    support.name = side < 0 ? 'Port-Integrated-Aft-Support' : 'Starboard-Integrated-Aft-Support';
    visual.add(support);
  }

  const engineFlames = [];
  const engineLights = [];

  for (const side of [-1, 1]) {
    // Nacelles recuadas: paralelas ao eixo longitudinal e ligadas à popa integrada.
    const nacelle = new THREE.Group();
    nacelle.name = side < 0 ? 'Port-Warp-Nacelle' : 'Starboard-Warp-Nacelle';
    nacelle.position.set(side * 12.2, 0.1, 61);
    visual.add(nacelle);

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

  return { group, yaw, pitch, visual, engineFlames, engineLights };
}
