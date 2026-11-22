import * as THREE from 'three';
import { DECK_3_DEFLECTOR_APERTURE } from './deflectorAperture.js';

// Colar de manutenção embutido no anel frontal do defletor.
// A profundidade total acompanha o vão de serviço sem alterar o emissor.
export function createDeflectorInteriorStructure() {
  const group = new THREE.Group();
  group.name = 'Deck3-Deflector-Interior-Structure';
  const collar = new THREE.Group();
  collar.name = 'Deflector-Interior-Collar-Assembly';
  collar.position.set(
    DECK_3_DEFLECTOR_APERTURE.centerX,
    DECK_3_DEFLECTOR_APERTURE.centerY,
    DECK_3_DEFLECTOR_APERTURE.centerZ
  );
  group.add(collar);

  const depth = 1.5;
  const radius = 8.5;
  const verticalScale = (DECK_3_DEFLECTOR_APERTURE.radiusY - 0.35) / (radius + 0.42);
  const dark = new THREE.MeshStandardMaterial({
    color: 0x101b25, metalness: 0.92, roughness: 0.3
  });
  const edge = new THREE.MeshStandardMaterial({
    color: 0x243d4c, metalness: 0.86, roughness: 0.26
  });
  const light = new THREE.MeshBasicMaterial({ color: 0x31cfff });

  const addRing = (name, ringRadius, tube, material, z) => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(ringRadius, tube, 12, 128),
      material
    );
    mesh.name = name;
    mesh.scale.y = verticalScale;
    mesh.position.z = z;
    collar.add(mesh);
    return mesh;
  };

  // Dois aros pretos formam uma gola de 1,5 unidade ao redor do anel original.
  addRing('Deflector-Interior-Black-Collar-Front', radius + 0.18, 0.48, dark, -depth / 2);
  addRing('Deflector-Interior-Black-Collar-Rear', radius + 0.18, 0.48, dark, depth / 2);
  addRing('Deflector-Interior-Inner-Trim', radius - 0.48, 0.12, edge, 0);

  // Longarinas curtas conectam os dois aros e dão continuidade ao volume.
  for (let i = 0; i < 24; i += 1) {
    const angle = (i / 24) * Math.PI * 2;
    const x = Math.cos(angle) * (radius + 0.18);
    const y = Math.sin(angle) * (radius + 0.18) * verticalScale;
    const strut = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.3, depth),
      edge
    );
    strut.name = `Deflector-Interior-Collar-Strut-${String(i + 1).padStart(2, '0')}`;
    strut.position.set(x, y, 0);
    strut.rotation.z = angle;
    collar.add(strut);

    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.12, 0.16),
      light
    );
    lamp.name = `Deflector-Interior-Ring-Light-${String(i + 1).padStart(2, '0')}`;
    lamp.position.set(
      Math.cos(angle) * (radius + 0.18),
      Math.sin(angle) * (radius + 0.18) * verticalScale,
      0
    );
    lamp.rotation.z = angle;
    collar.add(lamp);
  }

  // Passarela curta liga a área caminhável do Deck 3 à face de manutenção do anel.
  const access = new THREE.Group();
  access.name = 'Deck3-Deflector-Maintenance-Access';
  access.position.set(0, -2.9, -41.35);
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.18, 5.3), dark
  );
  platform.name = 'Deflector-Access-Catwalk';
  platform.position.y = 0.09;
  access.add(platform);

  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.9, 5.3), edge
    );
    rail.name = side < 0 ? 'Deflector-Access-Port-Rail' : 'Deflector-Access-Starboard-Rail';
    rail.position.set(side * 1.22, 0.54, 0);
    access.add(rail);

    const railLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.055, 4.8), light
    );
    railLight.name = side < 0 ? 'Deflector-Access-Port-Light' : 'Deflector-Access-Starboard-Light';
    railLight.position.set(side * 1.22, 0.98, 0);
    access.add(railLight);
  }

  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 2.25, 0.24), edge
    );
    post.name = side < 0 ? 'Deflector-Access-Entry-Port-Post' : 'Deflector-Access-Entry-Starboard-Post';
    post.position.set(side * 1.42, 1.12, 2.52);
    access.add(post);
  }

  const entryHeader = new THREE.Mesh(
    new THREE.BoxGeometry(3.05, 0.22, 0.24), edge
  );
  entryHeader.name = 'Deflector-Access-Deck3-Entry-Header';
  entryHeader.position.set(0, 2.2, 2.52);
  access.add(entryHeader);

  const thresholdGlow = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.055, 0.07), light
  );
  thresholdGlow.name = 'Deflector-Access-Deck3-Threshold-Light';
  thresholdGlow.position.set(0, 2.1, 2.4);
  access.add(thresholdGlow);

  group.add(access);

  // Estação operacional instalada dentro da câmara do defletor, após a entrada
  // do Deck 3. Não ocupa nem cria uma placa no piso geral do convés.
  const consoleStation = new THREE.Group();
  consoleStation.name = 'Deflector-Interior-Computer-Console';
  consoleStation.position.set(3.35, -2.9, -42.55);
  consoleStation.rotation.y = Math.PI;
  group.add(consoleStation);

  const consoleBase = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.2, 1.8), dark);
  consoleBase.name = 'Deflector-Console-Floor-Plinth';
  consoleBase.position.y = 0.1;
  consoleStation.add(consoleBase);
  const consoleBody = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.78, 1.35), edge);
  consoleBody.name = 'Deflector-Console-Armored-Body';
  consoleBody.position.set(0, 0.58, -0.08);
  consoleStation.add(consoleBody);
  const consoleDisplay = new THREE.Mesh(
    new THREE.BoxGeometry(2.12, 0.075, 0.82),
    new THREE.MeshStandardMaterial({ color: 0x082d40, emissive: 0x087fa8, emissiveIntensity: 1.35, metalness: 0.25, roughness: 0.2 })
  );
  consoleDisplay.name = 'Deflector-Console-Ship-Computer-Display';
  consoleDisplay.position.set(0, 1.02, 0.48);
  consoleDisplay.rotation.x = -0.24;
  consoleStation.add(consoleDisplay);
  const consoleStatus = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.055, 0.07), light);
  consoleStatus.name = 'Deflector-Console-Computer-Link-Light';
  consoleStatus.position.set(-0.78, 1.04, 0.88);
  consoleStation.add(consoleStatus);
  for (const side of [-1, 1]) {
    const control = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.48), edge);
    control.name = side < 0 ? 'Deflector-Console-Port-Control' : 'Deflector-Console-Starboard-Control';
    control.position.set(side * 1.02, 0.96, 0.18);
    consoleStation.add(control);
    const indicator = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.035, 0.24), light);
    indicator.name = side < 0 ? 'Deflector-Console-Port-Indicator' : 'Deflector-Console-Starboard-Indicator';
    indicator.position.set(side * 1.02, 1.015, 0.2);
    consoleStation.add(indicator);
  }

  group.userData.depth = depth;
  group.userData.deck = 'D3';
  group.userData.lightCount = 24;
  return group;
}
