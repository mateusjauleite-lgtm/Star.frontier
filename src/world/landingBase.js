import * as THREE from 'three';

// Dimensões da infraestrutura em metros no referencial local do local de pouso.
export const LANDING_BASE_METRICS = Object.freeze({
  platformRadiusMeters: 150,
  stationCenterEastMeters: 178,
  stationCenterNorthMeters: 0,
  stationHalfWidthMeters: 4.7,
  stationHalfDepthMeters: 3.7,
  minimumStationClearanceMeters: 10,
  shipEnvelopeForwardMeters: 50,
  shipEnvelopeAftMeters: 105,
  shipEnvelopeHalfWidthMeters: 27.2,
  shipEnvelopeMaximumRadiusMeters: Math.hypot(105, 27.2)
});

const stationFootprintRadiusMeters = Math.hypot(
  LANDING_BASE_METRICS.stationHalfWidthMeters,
  LANDING_BASE_METRICS.stationHalfDepthMeters
);
export const LANDING_BASE_CLEARANCE_METERS =
  Math.hypot(LANDING_BASE_METRICS.stationCenterEastMeters,
    LANDING_BASE_METRICS.stationCenterNorthMeters) -
  stationFootprintRadiusMeters - LANDING_BASE_METRICS.platformRadiusMeters;

// Complexo terrestre de Uyuni. A raiz recebe a orientação geodésica da Earth;
// plataforma e estação permanecem como grupos independentes para evolução/LOD.
export function createLandingBase() {
  const group = new THREE.Group();
  group.name = 'StarFrontier-Uyuni-Base-Complex';
  group.userData.landingMetrics = {
    unit: 'meter',
    ...LANDING_BASE_METRICS,
    calculatedStationClearanceMeters: LANDING_BASE_CLEARANCE_METERS,
    clearanceValidatedGeometrically:
      LANDING_BASE_CLEARANCE_METERS >= LANDING_BASE_METRICS.minimumStationClearanceMeters
  };

  const platform = new THREE.Group();
  platform.name = 'StarFrontier-Uyuni-Landing-Platform';
  const station = new THREE.Group();
  station.name = 'StarFrontier-Uyuni-Surface-Station';
  group.add(platform, station);

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

  const add = (target, geometry, material, position, rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    target.add(mesh);
    return mesh;
  };

  // Zona de pouso: permanece livre de edifícios e pode receber colisão própria.
  add(platform, new THREE.CylinderGeometry(LANDING_BASE_METRICS.platformRadiusMeters, LANDING_BASE_METRICS.platformRadiusMeters, 1.15, 96), foundation, [0, 0.05, 0]);
  add(platform, new THREE.CylinderGeometry(146, 146, 0.16, 96), deck, [0, 0.68, 0]);
  add(platform, new THREE.TorusGeometry(145, 0.22, 8, 128), marking, [0, 0.8, 0], [Math.PI / 2, 0, 0]);
  add(platform, new THREE.TorusGeometry(75, 0.16, 8, 96), marking, [0, 0.8, 0], [Math.PI / 2, 0, 0]);
  add(platform, new THREE.BoxGeometry(0.32, 0.035, 70), marking, [0, 0.81, 0]);
  add(platform, new THREE.BoxGeometry(70, 0.035, 0.32), marking, [0, 0.81, 0]);
  add(platform, new THREE.ConeGeometry(2.1, 5, 4), marking, [0, 0.9, -75], [-Math.PI / 2, 0, 0]);

  // Balizamento baixo no perímetro, sem obstruir o corredor de aproximação.
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const x = Math.cos(angle) * 140;
    const z = Math.sin(angle) * 140;
    add(platform, new THREE.CylinderGeometry(0.48, 0.58, 0.22, 12), foundation, [x, 0.86, z]);
    add(platform, new THREE.SphereGeometry(0.24, 10, 8), lamp, [x, 1.02, z]);
  }

  const beacon = new THREE.PointLight(0x48cfff, 1.1, 150);
  beacon.position.set(0, 5, 0);
  platform.add(beacon);

  // Estação fora do círculo de pouso. Seu grupo pode ser movido/expandido
  // sem alterar a plataforma nem a referência de orientação geográfica.
  station.position.set(
    LANDING_BASE_METRICS.stationCenterEastMeters, 0,
    LANDING_BASE_METRICS.stationCenterNorthMeters
  );
  add(station, new THREE.BoxGeometry(9, 4.2, 7), habitat, [0, 2.7, 0]);
  add(station, new THREE.BoxGeometry(5.8, 1.8, 0.16), glass, [0, 2.95, -3.58]);
  add(station, new THREE.BoxGeometry(9.4, 0.38, 7.4), foundation, [0, 4.95, 0]);
  add(station, new THREE.CylinderGeometry(0.22, 0.3, 4.5, 8), foundation, [4, 7.2, 2]);
  add(station, new THREE.SphereGeometry(0.34, 10, 8), lamp, [4, 9.55, 2]);

  return {
    group,
    platform,
    station,
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
