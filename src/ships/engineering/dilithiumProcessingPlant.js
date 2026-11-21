import * as THREE from 'three';
import { DILITHIUM_COMPONENT_IDS } from './dilithiumProcessingSystem.js';

export function createDilithiumProcessingPlant() {
  const group = new THREE.Group();
  group.name = 'Deck-3-Dilithium-Processing-Plant';
  group.position.set(-8.5, -2.72, -2);
  group.userData.entityId = 'assembly:dilithium-processing';

  const frame = new THREE.MeshStandardMaterial({ color: 0x172e40, metalness: 0.88, roughness: 0.3 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x58778b, metalness: 0.82, roughness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x071b2b, metalness: 0.55, roughness: 0.32 });
  const cyan = new THREE.MeshBasicMaterial({ color: 0x43dcff });
  const crystal = new THREE.MeshPhysicalMaterial({ color: 0x73eaff, emissive: 0x0b8eaf, emissiveIntensity: 1.3, transparent: true, opacity: 0.72, roughness: 0.16 });

  const add = (parent, geometry, material, name, position) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  add(group, new THREE.BoxGeometry(7.4, 0.18, 3.1), frame, 'Dilithium-Plant-Foundation', [0, 0, 0]);
  add(group, new THREE.BoxGeometry(7.05, 0.07, 2.8), dark, 'Dilithium-Plant-Deck', [0, 0.13, 0]);

  const rawStorage = new THREE.Group();
  rawStorage.name = 'Raw-Dilithium-Storage';
  rawStorage.userData.entityId = DILITHIUM_COMPONENT_IDS.RAW_STORAGE;
  rawStorage.position.set(-2.35, 0.18, 0);
  group.add(rawStorage);
  add(rawStorage, new THREE.BoxGeometry(1.65, 1.55, 1.75), steel, 'Raw-Storage-Housing', [0, 0.82, 0]);
  add(rawStorage, new THREE.BoxGeometry(1.35, 0.12, 1.48), dark, 'Raw-Storage-Top', [0, 1.62, 0]);
  for (let i = 0; i < 3; i++) add(rawStorage, new THREE.OctahedronGeometry(0.25, 0), crystal, `Raw-Dilithium-Crystal-${i + 1}`, [-0.35 + i * 0.34, 0.88 + (i % 2) * 0.12, 0.04]);

  const refinery = new THREE.Group();
  refinery.name = 'Dilithium-Refinery-Machine';
  refinery.userData.entityId = DILITHIUM_COMPONENT_IDS.REFINERY;
  refinery.userData.processing = false;
  group.add(refinery);
  add(refinery, new THREE.CylinderGeometry(0.78, 0.92, 1.7, 24), frame, 'Refinery-Pressure-Chamber', [0, 1.02, 0]);
  add(refinery, new THREE.CylinderGeometry(0.62, 0.62, 0.12, 24), cyan, 'Refinery-Upper-Energy-Ring', [0, 1.91, 0]);
  add(refinery, new THREE.CylinderGeometry(0.62, 0.62, 0.12, 24), cyan, 'Refinery-Lower-Energy-Ring', [0, 0.16, 0]);
  add(refinery, new THREE.CylinderGeometry(0.38, 0.38, 0.92, 16), crystal, 'Refinery-Dilithium-Process-Chamber', [0, 1.02, 0]);
  add(refinery, new THREE.BoxGeometry(1.3, 0.38, 0.35), dark, 'Refinery-Control-Panel', [0, 0.78, 0.88]);
  for (let i = 0; i < 4; i++) {
    const pipe = add(group, new THREE.CylinderGeometry(0.07, 0.07, 1.15, 8), cyan, `Dilithium-Conduit-${i + 1}`, [-1.2 + i * 0.8, 0.62, 0.92]);
    pipe.rotation.z = Math.PI / 2;
  }

  const refinedStorage = new THREE.Group();
  refinedStorage.name = 'Refined-Dilithium-Storage';
  refinedStorage.userData.entityId = DILITHIUM_COMPONENT_IDS.REFINED_STORAGE;
  refinedStorage.position.set(2.35, 0.18, 0);
  group.add(refinedStorage);
  add(refinedStorage, new THREE.BoxGeometry(1.65, 1.55, 1.75), steel, 'Refined-Storage-Housing', [0, 0.82, 0]);
  add(refinedStorage, new THREE.BoxGeometry(1.35, 0.12, 1.48), dark, 'Refined-Storage-Top', [0, 1.62, 0]);
  add(refinedStorage, new THREE.OctahedronGeometry(0.48, 1), crystal, 'Refined-Dilithium-Indicator', [0, 0.95, 0]);

  const coreConduit = add(group, new THREE.CylinderGeometry(0.09, 0.09, 5.8, 10), cyan, 'Warp-Core-Dilithium-Transfer-Conduit', [6.2, 0.45, 0.55]);
  coreConduit.rotation.z = Math.PI / 2;
  const statusLight = add(refinery, new THREE.SphereGeometry(0.12, 12, 8), cyan, 'Refinery-Status-Light', [0.52, 1.35, 0.85]);

  group.userData.components = {
    rawStorage, refinery, refinedStorage, coreConduit, statusLight
  };
  group.userData.dispose = () => {
    group.traverse(object => {
      if (!object.isMesh) return;
      object.geometry?.dispose();
      if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
      else object.material?.dispose();
    });
    [frame, steel, dark, cyan, crystal].forEach(material => material.dispose());
  };
  return group;
}
