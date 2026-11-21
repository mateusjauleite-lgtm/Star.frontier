import * as THREE from 'three';

// Núcleo de dobra vertical entre os decks 2 e 3.
// O conjunto é apenas visual nesta etapa: não cria paredes nem caixas de colisão.
export function createEngineeringWarpCore() {
  const group = new THREE.Group();
  group.name = 'Engineering-Warp-Core-Assembly';
  group.position.set(0, 0, -2);

  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x142b3a, metalness: 0.9, roughness: 0.28
  });
  const edgeMetal = new THREE.MeshStandardMaterial({
    color: 0x527487, metalness: 0.82, roughness: 0.24
  });
  const cyanLight = new THREE.MeshBasicMaterial({ color: 0x36dcff });
  const coreShell = new THREE.MeshPhysicalMaterial({
    color: 0x8beeff, metalness: 0.12, roughness: 0.08,
    transparent: true, opacity: 0.2, transmission: 0.35,
    thickness: 0.35, emissive: 0x087fa8, emissiveIntensity: 1.25,
    side: THREE.DoubleSide, depthWrite: false
  });
  const plasmaMaterial = new THREE.MeshBasicMaterial({
    color: 0x39dfff, transparent: true, opacity: 0.48,
    blending: THREE.AdditiveBlending, depthWrite: false
  });

  const add = (parent, geometry, material, name, position = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  };

  // Base de contenção assentada no piso do Deck 3.
  add(group, new THREE.CylinderGeometry(3.15, 3.35, 0.34, 64),
    darkMetal, 'Engineering-Core-Foundation', [0, -2.48, 0]);
  add(group, new THREE.TorusGeometry(2.82, 0.13, 12, 64),
    cyanLight, 'Engineering-Core-Foundation-Light-Ring', [0, -2.27, 0]);

  // Câmara transparente: a energia permanece visível através da estrutura.
  add(group, new THREE.CylinderGeometry(1.52, 1.52, 5.05, 48, 1, true),
    coreShell, 'Engineering-Core-Transparent-Chamber', [0, 0.12, 0]);
  add(group, new THREE.CylinderGeometry(0.78, 0.78, 4.75, 40, 1, true),
    plasmaMaterial, 'Engineering-Core-Energized-Plasma', [0, 0.12, 0]);

  // Anéis de contenção luminosos dentro da câmara, sem formar paredes.
  for (const [index, y] of [-1.72, -0.55, 0.62, 1.79].entries()) {
    const ring = add(group, new THREE.TorusGeometry(1.55, 0.055, 8, 48),
      cyanLight, `Engineering-Core-Containment-Ring-${index + 1}`, [0, y, 0]);
    ring.rotation.x = Math.PI / 2;
  }

  const energySpiral = new THREE.CatmullRomCurve3(
    Array.from({ length: 49 }, (_, index) => {
      const t = index / 48;
      const angle = t * Math.PI * 8;
      return new THREE.Vector3(
        Math.cos(angle) * (0.42 + t * 0.25),
        -2.12 + t * 4.48,
        Math.sin(angle) * (0.42 + t * 0.25)
      );
    })
  );
  add(group, new THREE.TubeGeometry(energySpiral, 160, 0.075, 8, false),
    cyanLight, 'Engineering-Core-Energy-Spiral');

  const crown = add(group, new THREE.CylinderGeometry(1.9, 1.9, 0.2, 48),
    edgeMetal, 'Engineering-Core-Upper-Collar', [0, 2.78, 0]);
  crown.material = edgeMetal;
  add(group, new THREE.TorusGeometry(1.72, 0.09, 10, 48),
    cyanLight, 'Engineering-Core-Upper-Light-Ring', [0, 2.9, 0]);

  // Bancada anelar baixa no Deck 2: superfície circular vazada, sem paredes.
  const benchShape = new THREE.Shape();
  benchShape.absellipse(0, 0, 5.15, 5.15, 0, Math.PI * 2, false, 0);
  const benchOpening = new THREE.Path();
  benchOpening.absellipse(0, 0, 3.58, 3.58, 0, Math.PI * 2, true, 0);
  benchShape.holes.push(benchOpening);
  const bench = add(group,
    new THREE.ExtrudeGeometry(benchShape, {
      depth: 0.2, bevelEnabled: false, curveSegments: 64
    }),
    darkMetal, 'Engineering-Core-Deck-2-Open-Work-Bench', [0, 3.27, 0]);
  bench.rotation.x = Math.PI / 2;

  const benchEdge = add(group, new THREE.TorusGeometry(5.02, 0.075, 10, 64),
    edgeMetal, 'Engineering-Core-Work-Bench-Outer-Edge', [0, 3.25, 0]);
  benchEdge.rotation.x = Math.PI / 2;
  const innerEdge = add(group, new THREE.TorusGeometry(3.62, 0.045, 8, 64),
    cyanLight, 'Engineering-Core-Work-Bench-Inner-Light', [0, 3.25, 0]);
  innerEdge.rotation.x = Math.PI / 2;

  // Console físico no Deck 3, afastado do núcleo e voltado para ele.
  const console = new THREE.Group();
  console.name = 'Engineering-Deck-3-Ship-Computer-Console';
  console.position.set(8.1, -2.72, -2);
  console.rotation.y = -Math.PI / 2;
  group.add(console);

  add(console, new THREE.BoxGeometry(3.15, 0.2, 1.85),
    darkMetal, 'Engineering-Console-Floor-Base', [0, 0.1, 0]);
  add(console, new THREE.BoxGeometry(2.72, 1.08, 1.42),
    edgeMetal, 'Engineering-Console-Body', [0, 0.72, -0.08]);
  const displayMaterial = new THREE.MeshStandardMaterial({
    color: 0x092d40, emissive: 0x087fa8, emissiveIntensity: 1.35,
    metalness: 0.28, roughness: 0.2
  });
  const display = add(console, new THREE.BoxGeometry(2.35, 0.08, 0.78),
    displayMaterial, 'Engineering-Console-Display', [0, 1.36, 0.42]);
  display.rotation.x = -0.18;
  add(console, new THREE.BoxGeometry(0.55, 0.045, 0.08),
    cyanLight, 'Engineering-Console-Status-Light', [-0.88, 1.37, 0.84]);

  const coreLight = new THREE.PointLight(0x27cfff, 2.1, 13);
  coreLight.position.set(0, 0.2, 0);
  coreLight.name = 'Engineering-Core-Blue-Light';
  group.add(coreLight);

  return group;
}
