import * as THREE from 'three';

// Instalação física independente; a lógica energética continua no warpCorePowerSystem.
export const DILITHIUM_MATRIX_LOCAL_POSITION = Object.freeze({ x: 2.3, y: -2.67, z: 5.3 });
export const DILITHIUM_MATRIX_TERMINAL_LOCAL_POSITION = Object.freeze({ x: 5.05, y: -2.67, z: 5.15 });

export function createDilithiumMatrix() {
  const root = new THREE.Group();
  root.name = 'Engineering-Dilithium-Matrix-Installation';
  root.position.set(DILITHIUM_MATRIX_LOCAL_POSITION.x, DILITHIUM_MATRIX_LOCAL_POSITION.y, DILITHIUM_MATRIX_LOCAL_POSITION.z);

  const dark = new THREE.MeshStandardMaterial({ color: 0x102b3b, metalness: 0.88, roughness: 0.3 });
  const alloy = new THREE.MeshStandardMaterial({ color: 0x496b7c, metalness: 0.84, roughness: 0.26 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x8beaff, transparent: true, opacity: 0.16, roughness: 0.08, transmission: 0.45, thickness: 0.25, side: THREE.DoubleSide, depthWrite: false });
  const cyan = new THREE.MeshBasicMaterial({ color: 0x39dfff });
  const plasma = new THREE.MeshBasicMaterial({ color: 0x23bde9, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const add = (parent, geometry, material, name, position = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // Base circular baixa, assentada no Deck 3, sem footprint de parede.
  add(root, new THREE.CylinderGeometry(1.78, 1.92, 0.22, 64), dark, 'Matrix-Foundation', [0, -0.02, 0]);
  add(root, new THREE.TorusGeometry(1.67, 0.075, 10, 64), cyan, 'Matrix-Foundation-Status-Ring', [0, 0.11, 0]);
  add(root, new THREE.CylinderGeometry(1.28, 1.36, 0.32, 48), alloy, 'Matrix-Lower-Containment-Deck', [0, 0.23, 0]);
  add(root, new THREE.CylinderGeometry(1.03, 1.03, 1.92, 48, 1, true), glass, 'Matrix-Containment-Chamber', [0, 1.28, 0]);
  add(root, new THREE.CylinderGeometry(0.57, 0.68, 1.72, 40), plasma, 'Matrix-Plasma-Column', [0, 1.3, 0]);
  const crystal = add(root, new THREE.OctahedronGeometry(0.58, 1), cyan, 'Matrix-Dilithium-Crystal', [0, 1.3, 0]);
  crystal.rotation.set(0.18, Math.PI / 4, 0.12);

  for (const [i, y] of [0.48, 1.28, 2.08].entries()) {
    const ring = add(root, new THREE.TorusGeometry(1.18, 0.075, 12, 64), alloy, 'Matrix-Regulator-Ring-' + (i + 1), [0, y, 0]);
    ring.rotation.x = Math.PI / 2;
    const glow = add(root, new THREE.TorusGeometry(1.28, 0.022, 8, 64), cyan, 'Matrix-Regulator-Glow-' + (i + 1), [0, y, 0]);
    glow.rotation.x = Math.PI / 2;
  }

  // Quatro montantes externos sustentam a câmara sem fechar o corredor.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const x = Math.cos(a) * 1.47, z = Math.sin(a) * 1.47;
    add(root, new THREE.BoxGeometry(0.16, 2.2, 0.16), alloy, 'Matrix-Containment-Support-' + (i + 1), [x, 1.2, z]);
    add(root, new THREE.SphereGeometry(0.12, 12, 8), cyan, 'Matrix-Support-Indicator-' + (i + 1), [x, 2.32, z]);
  }
  add(root, new THREE.CylinderGeometry(1.38, 1.38, 0.18, 48), alloy, 'Matrix-Upper-Cap', [0, 2.42, 0]);
  add(root, new THREE.TorusGeometry(1.22, 0.055, 10, 48), cyan, 'Matrix-Upper-Cap-Light', [0, 2.53, 0]);

  // Três conectores identificados; as linhas EPS existentes continuam sendo a rede real.
  const ports = [
    { id: 'critical', x: -0.86, z: -1.18 },
    { id: 'operations', x: 0.86, z: -1.18 },
    { id: 'warp', x: 0, z: 1.42 }
  ];
  for (const port of ports) {
    add(root, new THREE.CylinderGeometry(0.12, 0.12, 0.34, 16), alloy, 'Matrix-EPS-Port-' + port.id, [port.x, 0.3, port.z]);
    add(root, new THREE.TorusGeometry(0.13, 0.025, 8, 20), cyan, 'Matrix-EPS-Port-Light-' + port.id, [port.x, 0.48, port.z]);
  }

  const light = new THREE.PointLight(0x28cfff, 1.4, 8);
  light.name = 'Matrix-Containment-Light';
  light.position.set(0, 1.3, 0);
  root.add(light);
  root.userData.footprint = { radius: 1.95, height: 2.7, walkableClearance: 0.85 };
  return root;
}
