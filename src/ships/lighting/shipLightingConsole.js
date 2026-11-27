import * as THREE from 'three';

export const SHIP_LIGHTING_CONSOLE_LOCAL_POSITION = Object.freeze({
  x: 10.5,
  y: 8.91,
  z: -20
});
export const SHIP_LIGHTING_CONSOLE_DISPLAY_RADIUS = 8;
export const SHIP_LIGHTING_CONSOLE_INTERACTION_RADIUS = 3.6;

export function isShipLightingConsoleInRange(
  position,
  deckIndex,
  mode = 'on-foot',
  inWorldFrame = false,
  radius = SHIP_LIGHTING_CONSOLE_INTERACTION_RADIUS
) {
  if (!position || ![position.x, position.y, position.z].every(Number.isFinite)) return false;
  if (deckIndex !== 0 || mode !== 'on-foot' || inWorldFrame) return false;
  if (!Number.isFinite(radius) || radius < 0) return false;
  const dx = position.x - SHIP_LIGHTING_CONSOLE_LOCAL_POSITION.x;
  const dy = position.y - SHIP_LIGHTING_CONSOLE_LOCAL_POSITION.y;
  const dz = position.z - SHIP_LIGHTING_CONSOLE_LOCAL_POSITION.z;
  return dx * dx + dy * dy + dz * dz <= radius * radius;
}

export function createShipLightingConsole() {
  const group = new THREE.Group();
  group.name = 'D1-Aurora-Lighting-Console';

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x25394b, metalness: 0.82, roughness: 0.34
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x8fa9ba, metalness: 0.72, roughness: 0.3
  });
  const displayMaterial = new THREE.MeshBasicMaterial({
    color: 0x45d8ff, toneMapped: false
  });

  const addPart = (name, size, position, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  const { x, y, z } = SHIP_LIGHTING_CONSOLE_LOCAL_POSITION;
  addPart('D1-Lighting-Console-Pedestal', [0.78, 0.82, 0.82], [x, y + 0.43, z], frameMaterial);
  addPart('D1-Lighting-Console-Control-Surface', [1.28, 0.13, 1.08], [x, y + 0.91, z], trimMaterial);
  // A tela fica voltada para o centro da ponte (-X), visível ao se aproximar.
  addPart('D1-Lighting-Console-Display-Bezel', [0.12, 0.72, 0.98], [x - 0.48, y + 1.36, z], frameMaterial);
  addPart('D1-Lighting-Console-Display', [0.025, 0.57, 0.82], [x - 0.55, y + 1.36, z], displayMaterial);
  addPart('D1-Lighting-Console-Status-Bar', [0.025, 0.045, 0.62], [x - 0.568, y + 1.12, z], trimMaterial);

  return {
    group,
    collisionBoxes: [{
      x, y: y + 0.43, z,
      halfX: 0.48, halfY: 0.48, halfZ: 0.48
    }],
    dispose() {
      group.traverse(object => {
        if (!object.isMesh) return;
        object.geometry?.dispose();
        if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
        else object.material?.dispose();
      });
      frameMaterial.dispose();
      trimMaterial.dispose();
      displayMaterial.dispose();
    }
  };
}
