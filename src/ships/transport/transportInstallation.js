import * as THREE from 'three';

export const DECK_2_TRANSPORTER_LAYOUT = Object.freeze({
  platform: Object.freeze({ x: -12, y: 3.12, z: 27 }),
  // Console no lado oposto ao elevador, mantendo distância segura da plataforma.
  // Recuado para dentro do volume útil do casco: mantém folga vertical do teto elipsoidal.
  console: Object.freeze({ x: -19.5, y: 3.12, z: 20.5 }),
  platformRadius: 2.55,
  consoleInteractionRadius: 3.6,
  consoleVisibilityRadius: 8,
  platformInteractionRadius: 2.9,
  emitterCount: 6
});

export function createDeck2TransporterInstallation() {
  const root = new THREE.Group();
  root.name = 'Deck2-Transporter-Installation';
  const platform = new THREE.Group();
  platform.name = 'Deck2-Transporter-Platform';
  platform.position.set(
    DECK_2_TRANSPORTER_LAYOUT.platform.x,
    DECK_2_TRANSPORTER_LAYOUT.platform.y,
    DECK_2_TRANSPORTER_LAYOUT.platform.z
  );
  root.add(platform);

  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x101b2b, metalness: 0.88, roughness: 0.28 });
  const brushedMetal = new THREE.MeshStandardMaterial({ color: 0x77899a, metalness: 0.82, roughness: 0.32 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xb58b43, metalness: 0.86, roughness: 0.24 });
  const blue = new THREE.MeshBasicMaterial({ color: 0x287dff });
  const blueGlow = new THREE.MeshBasicMaterial({ color: 0x4b8dff, transparent: true, opacity: 0.3 });
  const consoleScreen = new THREE.MeshBasicMaterial({ color: 0x267eff });

  const cylinder = (parent, name, radiusTop, radiusBottom, height, material, y, radialSegments = 48) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments),
      material
    );
    mesh.name = name;
    mesh.position.y = y;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // Base baixa, aro externo e superfície central azul: plataforma única de transporte.
  cylinder(platform, 'Transporter-Platform-Base', 2.55, 2.62, 0.22, darkMetal, 0.11);
  cylinder(platform, 'Transporter-Platform-Upper-Ring', 2.43, 2.43, 0.09, brushedMetal, 0.265);
  cylinder(platform, 'Transporter-Platform-Deck', 2.28, 2.28, 0.035, darkMetal, 0.325);
  cylinder(platform, 'Transporter-Platform-Center-Emitter', 0.88, 0.88, 0.045, blue, 0.35);
  cylinder(platform, 'Transporter-Platform-Center-Glow', 1.02, 1.02, 0.018, blueGlow, 0.377);

  const emitters = new THREE.Group();
  emitters.name = 'Transporter-Emitter-Array';
  platform.add(emitters);
  const emitterRadius = 2.08;
  for (let i = 0; i < DECK_2_TRANSPORTER_LAYOUT.emitterCount; i += 1) {
    const angle = (Math.PI * 2 * i) / DECK_2_TRANSPORTER_LAYOUT.emitterCount;
    const x = Math.cos(angle) * emitterRadius;
    const z = Math.sin(angle) * emitterRadius;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 3.45, 10), gold);
    post.name = `Transporter-Emitter-Column-${i + 1}`;
    post.position.set(x, 2.08, z);
    emitters.add(post);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.12, 32), gold);
    head.name = `Transporter-Emitter-Head-${i + 1}`;
    head.position.set(x, 3.83, z);
    emitters.add(head);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.025, 32), blue);
    lens.name = `Transporter-Emitter-Lens-${i + 1}`;
    lens.position.set(x, 3.902, z);
    emitters.add(lens);
  }
  cylinder(emitters, 'Transporter-Emitter-Upper-Hub', 1.12, 1.12, 0.14, darkMetal, 3.9);
  cylinder(emitters, 'Transporter-Emitter-Upper-Blue-Hub', 0.82, 0.82, 0.035, blue, 3.99);

  // Console físico único, ao lado da plataforma e voltado para a área de operação.
  const console = new THREE.Group();
  console.name = 'Deck2-Transporter-Control-Console';
  console.position.set(
    DECK_2_TRANSPORTER_LAYOUT.console.x,
    DECK_2_TRANSPORTER_LAYOUT.console.y,
    DECK_2_TRANSPORTER_LAYOUT.console.z
  );
  // A tela fica voltada para a plataforma e para a área de circulação do Deck 2.
  console.rotation.y = Math.atan2(
    DECK_2_TRANSPORTER_LAYOUT.platform.x - DECK_2_TRANSPORTER_LAYOUT.console.x,
    DECK_2_TRANSPORTER_LAYOUT.platform.z - DECK_2_TRANSPORTER_LAYOUT.console.z
  );
  root.add(console);
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.05, 0.62), darkMetal);
  pedestal.name = 'Transporter-Console-Pedestal';
  pedestal.position.y = 0.525;
  console.add(pedestal);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.12, 0.76), brushedMetal);
  top.name = 'Transporter-Console-Top';
  top.position.set(0, 1.08, 0);
  console.add(top);
  const display = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.48, 0.055), consoleScreen);
  display.name = 'Transporter-Console-Display';
  display.position.set(0, 1.42, -0.12);
  display.rotation.x = -0.24;
  console.add(display);
  const statusLight = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), blue);
  statusLight.name = 'Transporter-Console-Status-Light';
  statusLight.position.set(0.34, 1.18, 0.2);
  console.add(statusLight);

  root.userData.deckId = 'D2';
  root.userData.installationType = 'single-transporter';
  root.userData.transporterCount = 1;
  root.userData.consoleCount = 1;
  root.userData.interaction = {
    terminalId: 'planetary-transport-console',
    systemId: 'planetary-transport'
  };
  root.userData.collisionBoxes = [
    { x: -12, y: 3.55, z: 27, halfX: 2.65, halfY: 0.25, halfZ: 2.65 },
    { x: DECK_2_TRANSPORTER_LAYOUT.console.x, y: DECK_2_TRANSPORTER_LAYOUT.console.y + 0.58, z: DECK_2_TRANSPORTER_LAYOUT.console.z, halfX: 0.62, halfY: 0.85, halfZ: 0.48 }
  ];

  root.traverse(object => {
    if (object.isMesh) {
      object.castShadow = false;
      object.receiveShadow = true;
    }
  });

  return {
    group: root,
    platform,
    console,
    collisionBoxes: root.userData.collisionBoxes,
    dispose() {
      root.traverse(object => {
        if (!object.isMesh) return;
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach(material => material.dispose?.());
        else object.material?.dispose?.();
      });
      [darkMetal, brushedMetal, gold, blue, blueGlow, consoleScreen].forEach(material => material.dispose());
    }
  };
}
