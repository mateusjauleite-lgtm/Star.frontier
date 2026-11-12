import * as THREE from 'three';

// Estação orbital Star Frontier: plataforma de pouso e observatório inferior pressurizado.
export function createStation(options = {}) {
  const {
    position = [24, 3, -65],
    scale = 1
  } = options;

  const group = new THREE.Group();
  group.name = 'StarFrontier-Station';
  group.position.set(...position);
  group.scale.setScalar(scale);

  const hull = new THREE.MeshStandardMaterial({
    color: 0x8298aa,
    metalness: 0.82,
    roughness: 0.28
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x172b40,
    metalness: 0.88,
    roughness: 0.3
  });
  const trim = new THREE.MeshStandardMaterial({
    color: 0x287eae,
    emissive: 0x073b67,
    emissiveIntensity: 0.65,
    metalness: 0.72,
    roughness: 0.24
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x70cfff,
    emissive: 0x073653,
    emissiveIntensity: 0.42,
    metalness: 0.18,
    roughness: 0.12,
    transmission: 0.28,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const floorGlass = new THREE.MeshStandardMaterial({
    color: 0x327da0,
    emissive: 0x092b45,
    emissiveIntensity: 0.5,
    metalness: 0.88,
    roughness: 0.16
  });
  const light = new THREE.MeshBasicMaterial({ color: 0x36caff });
  const warm = new THREE.MeshStandardMaterial({
    color: 0xffc879,
    emissive: 0x9a4b12,
    emissiveIntensity: 0.55
  });

  const addMesh = (parent, geometry, material, at, rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...at);
    mesh.rotation.set(...rotation);
    parent.add(mesh);
    return mesh;
  };

  const addBox = (parent, size, at, material, rotation = [0, 0, 0]) =>
    addMesh(parent, new THREE.BoxGeometry(...size), material, at, rotation);

  const addRing = (parent, radius, tube, y, material, segments = 96) =>
    addMesh(parent, new THREE.TorusGeometry(radius, tube, 8, segments), material, [0, y, 0], [Math.PI / 2, 0, 0]);

  // Observatório inferior: painéis panorâmicos separados por uma abertura real de entrada.
  // A passagem fica voltada para -Z, alinhada com a escadaria.
  addMesh(group, new THREE.CylinderGeometry(8.65, 8.65, 0.32, 64), dark, [0, -3.42, 0]);
  addMesh(group, new THREE.CylinderGeometry(8.35, 8.35, 0.12, 64), floorGlass, [0, -3.2, 0]);

  addRing(group, 8.72, 0.28, 0.48, hull);
  addRing(group, 8.72, 0.2, -3.38, trim);

  const wallRadius = 8.62;
  const wallSegments = 28;
  for (let i = 0; i < wallSegments; i++) {
    const angle = (i / wallSegments) * Math.PI * 2;
    const aroundEntry = Math.abs(Math.atan2(Math.sin(angle - Math.PI), Math.cos(angle - Math.PI))) < 0.34;
    if (aroundEntry) continue;

    const x = Math.sin(angle) * wallRadius;
    const z = Math.cos(angle) * wallRadius;
    addBox(group, [1.92, 3.55, 0.14], [x, -1.45, z], glass, [0, -angle, 0]);
    addBox(group, [0.13, 3.65, 0.16], [x, -1.45, z], dark, [0, -angle, 0]);
  }

  // Piso espelhado e iluminação interna visível através dos vidros.
  addMesh(group, new THREE.CylinderGeometry(8.25, 8.25, 0.18, 64), floorGlass, [0, -3.02, 0]);
  addRing(group, 6.9, 0.055, -2.91, light);
  addRing(group, 4.2, 0.045, -2.9, trim);
  addMesh(group, new THREE.CylinderGeometry(1.25, 1.25, 1.5, 24), dark, [0, -2.15, 0]);
  addMesh(group, new THREE.SphereGeometry(0.78, 24, 16), light, [0, -1.72, 0]);

  // Consoles e painéis internos simples, mantendo baixo custo gráfico no celular.
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const x = Math.cos(angle) * 6.35;
    const z = Math.sin(angle) * 6.35;
    const consoleUnit = new THREE.Group();
    consoleUnit.position.set(x, -2.35, z);
    consoleUnit.rotation.y = -angle + Math.PI / 2;
    group.add(consoleUnit);
    addBox(consoleUnit, [1.25, 0.72, 0.42], [0, 0, 0], dark);
    addBox(consoleUnit, [1.05, 0.38, 0.06], [0, 0.12, -0.24], trim);
    addBox(consoleUnit, [0.82, 0.035, 0.08], [0, 0.34, -0.25], light);
  }

  // Plataforma superior circular: área livre para pouso da Aurora-7.
  addMesh(group, new THREE.CylinderGeometry(11.25, 11.65, 1.05, 96), dark, [0, 1.45, 0]);
  addMesh(group, new THREE.CylinderGeometry(10.95, 10.95, 0.12, 96), hull, [0, 2.02, 0]);
  addMesh(group, new THREE.CylinderGeometry(9.5, 9.5, 0.035, 96), floorGlass, [0, 2.1, 0]);
  addRing(group, 10.65, 0.12, 2.12, trim);
  addRing(group, 7.7, 0.045, 2.13, light);

  // Marcações da área de pouso.
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2;
    const marker = addBox(
      group,
      [2.4, 0.035, 0.16],
      [Math.cos(angle) * 5.1, 2.14, Math.sin(angle) * 5.1],
      light
    );
    marker.rotation.y = -angle;
  }
  addMesh(group, new THREE.CylinderGeometry(1.45, 1.45, 0.045, 48), trim, [0, 2.15, 0]);
  addRing(group, 1.05, 0.055, 2.18, light, 48);

  // Escadaria central protegida pelo escudo, descendo até a porta do piso -1.
  for (let i = 0; i < 11; i++) {
    const y = 1.78 - i * 0.43;
    const z = -4.1 - i * 0.34;
    addBox(group, [2.5, 0.13, 0.48], [0, y, z], i % 2 ? hull : dark);
    addBox(group, [2.25, 0.025, 0.035], [0, y + 0.075, z - 0.18], light);
  }
  // Portal aberto: sem painel de vidro bloqueando a passagem.
  addBox(group, [0.18, 2.35, 0.2], [-1.18, -1.62, -8.48], dark);
  addBox(group, [0.18, 2.35, 0.2], [1.18, -1.62, -8.48], dark);
  addBox(group, [2.55, 0.18, 0.2], [0, -0.42, -8.48], dark);
  addBox(group, [0.08, 2.1, 0.08], [-1.05, -1.62, -8.58], light);
  addBox(group, [0.08, 2.1, 0.08], [1.05, -1.62, -8.58], light);

  // Guarda-corpo baixo no perímetro da plataforma, sem bloquear o pouso.
  addRing(group, 10.95, 0.075, 2.72, hull);
  for (let i = 0; i < 32; i++) {
    const angle = (i / 32) * Math.PI * 2;
    addBox(
      group,
      [0.09, 0.62, 0.09],
      [Math.cos(angle) * 10.95, 2.4, Math.sin(angle) * 10.95],
      dark
    );
  }

  // Escudo esférico integral: envolve plataforma, escadaria e observatório inferior.
  const shieldMaterial = new THREE.MeshBasicMaterial({
    color: 0x238fff,
    wireframe: true,
    transparent: true,
    opacity: 0.075,
    depthWrite: false
  });
  const shield = addMesh(
    group,
    new THREE.SphereGeometry(13.25, 40, 28),
    shieldMaterial,
    [0, -0.35, 0]
  );
  shield.scale.set(1.02, 0.9, 1.02);
  shield.name = 'Station-Integrated-Shield';

  const shieldGlow = new THREE.Mesh(
    new THREE.SphereGeometry(13.18, 32, 24),
    new THREE.MeshBasicMaterial({
      color: 0x167bff,
      transparent: true,
      opacity: 0.018,
      side: THREE.BackSide,
      depthWrite: false
    })
  );
  shieldGlow.position.set(0, -0.35, 0);
  shieldGlow.scale.set(1.02, 0.9, 1.02);
  group.add(shieldGlow);

  // Luzes de orientação e antenas compactas na borda da plataforma.
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const x = Math.cos(angle) * 9.9;
    const z = Math.sin(angle) * 9.9;
    addMesh(group, new THREE.BoxGeometry(0.22, 0.48, 0.22), light, [x, 2.48, z]);
  }
  for (const side of [-1, 1]) {
    addMesh(group, new THREE.CylinderGeometry(0.055, 0.08, 1.5, 8), hull, [side * 7.6, 3.0, 6.5]);
    addMesh(group, new THREE.SphereGeometry(0.12, 10, 8), warm, [side * 7.6, 3.8, 6.5]);
  }

  const beacon = new THREE.PointLight(0x42bfff, 1.7, 34);
  beacon.position.set(0, 3.5, 0);
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
