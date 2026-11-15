import * as THREE from 'three';

// Pequena base planetária no Salar de Uyuni: plataforma dimensionada para a nave
// atual e um único módulo técnico, sem edifícios ou paredes extensas.
export function createLandingBase() {
  const group = new THREE.Group();
  group.name = 'StarFrontier-Uyuni-Landing-Base';

  const foundation = new THREE.MeshStandardMaterial({
    color: 0x263b4c, metalness: 0.78, roughness: 0.42
  });
  const deck = new THREE.MeshStandardMaterial({
    color: 0x71899a, metalness: 0.72, roughness: 0.38
  });
  const marking = new THREE.MeshStandardMaterial({
    color: 0x36caff, emissive: 0x0876a5, emissiveIntensity: 0.65,
    metalness: 0.3, roughness: 0.35
  });
  const habitat = new THREE.MeshStandardMaterial({
    color: 0x405b70, metalness: 0.55, roughness: 0.42
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x8bdfff, metalness: 0.05, roughness: 0.12,
    transparent: true, opacity: 0.72, clearcoat: 0.8
  });
  const lamp = new THREE.MeshBasicMaterial({ color: 0x72e5ff });

  const add = (geometry, material, position, rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    group.add(mesh);
    return mesh;
  };

  // Plataforma ampla, baixa e aberta: sem paredes em torno da área de pouso.
  add(new THREE.CylinderGeometry(63, 64, 1.15, 96), foundation, [0, 0.05, 0]);
  add(new THREE.CylinderGeometry(60.5, 60.5, 0.16, 96), deck, [0, 0.68, 0]);
  add(new THREE.TorusGeometry(59.2, 0.22, 8, 96), marking, [0, 0.8, 0], [Math.PI / 2, 0, 0]);
  add(new THREE.TorusGeometry(29, 0.16, 8, 80), marking, [0, 0.8, 0], [Math.PI / 2, 0, 0]);

  // Marcas centrais e guia de aproximação orientada para norte verdadeiro (-Z).
  add(new THREE.BoxGeometry(0.32, 0.035, 36), marking, [0, 0.81, 0]);
  add(new THREE.BoxGeometry(36, 0.035, 0.32), marking, [0, 0.81, 0]);
  add(new THREE.ConeGeometry(2.1, 5, 4), marking, [0, 0.9, -39], [-Math.PI / 2, 0, 0]);

  // Oito luzes baixas no perímetro, sem postes altos que atrapalhem a aproximação.
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const x = Math.cos(angle) * 56;
    const z = Math.sin(angle) * 56;
    add(new THREE.CylinderGeometry(0.48, 0.58, 0.22, 12), foundation, [x, 0.86, z]);
    add(new THREE.SphereGeometry(0.24, 10, 8), lamp, [x, 1.02, z]);
  }

  // Um único módulo técnico compacto, deslocado para fora da zona de pouso.
  add(new THREE.BoxGeometry(9, 4.2, 7), habitat, [72, 2.7, 12]);
  add(new THREE.BoxGeometry(5.8, 1.8, 0.16), glass, [72, 2.95, 8.42]);
  add(new THREE.BoxGeometry(9.4, 0.38, 7.4), foundation, [72, 4.95, 12]);
  add(new THREE.CylinderGeometry(0.22, 0.3, 4.5, 8), foundation, [76, 7.2, 14]);
  add(new THREE.SphereGeometry(0.34, 10, 8), lamp, [76, 9.55, 14]);

  const beacon = new THREE.PointLight(0x48cfff, 1.1, 95);
  beacon.position.set(0, 5, 0);
  group.add(beacon);

  return {
    group,
    dispose() {
      group.traverse(object => {
        if (!object.isMesh) return;
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => material?.dispose());
      });
      beacon.dispose();
    }
  };
}
