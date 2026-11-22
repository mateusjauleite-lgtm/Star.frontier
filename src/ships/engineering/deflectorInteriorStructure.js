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
  access.position.set(0, -2.72, -41.35);
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
  group.userData.depth = depth;
  group.userData.deck = 'D3';
  group.userData.lightCount = 24;
  return group;
}
