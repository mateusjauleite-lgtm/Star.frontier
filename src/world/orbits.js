import * as THREE from 'three';

// Órbita visual e pequeno satélite artificial ao redor da Terra.
// A estação principal permanece fixa no ponto de aproximação do jogo.
export function createOrbitSystem(options = {}) {
  const center = options.center ?? [0, 0, -240];
  const radius = options.radius ?? 177;
  const gravitySystem = options.gravitySystem ?? null;
  const group = new THREE.Group();
  group.name = 'StarFrontier-Orbits';
  group.position.set(...center);

  const orbit = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.12, 8, 192),
    new THREE.MeshBasicMaterial({
      color: 0x48bde8,
      transparent: true,
      opacity: 0.22
    })
  );
  orbit.rotation.x = Math.PI / 2;
  group.add(orbit);

  const satellite = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1.1, 2.4),
    new THREE.MeshStandardMaterial({
      color: 0xb8c9d5,
      metalness: 0.72,
      roughness: 0.35
    })
  );
  satellite.add(body);

  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0x176ca4,
    emissive: 0x082c50,
    metalness: 0.45,
    roughness: 0.4
  });
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.12, 1.8),
      panelMaterial
    );
    panel.position.x = side * 3;
    satellite.add(panel);
  }

  const beacon = new THREE.PointLight(0x4bcfff, 1.2, 18);
  satellite.add(beacon);
  group.add(satellite);

  let angle = 2.45;
  const speed = options.angularSpeed ?? 0.012;
  let orbitalVelocity = null;

  const placeSatellite = () => {
    satellite.position.set(
      Math.cos(angle) * radius,
      0,
      Math.sin(angle) * radius
    );
    satellite.rotation.y = -angle + Math.PI / 2;
  };
  placeSatellite();
  if (gravitySystem) {
    orbitalVelocity = gravitySystem.circularOrbitVelocity(
      satellite.getWorldPosition(new THREE.Vector3()).toArray()
    );
  }

  return {
    group,
    update(delta) {
      const dt = Math.min(Math.max(delta || 0, 0), 0.04);
      if (gravitySystem && orbitalVelocity && dt > 0) {
        const currentPosition = satellite.getWorldPosition(new THREE.Vector3()).toArray();
        const next = gravitySystem.integrate(currentPosition, orbitalVelocity, dt);
        if (next) {
          const worldPosition = new THREE.Vector3(...next.position);
          group.updateWorldMatrix(true, false);
          satellite.position.copy(group.worldToLocal(worldPosition));
          orbitalVelocity = next.velocity;
        }
      } else {
        angle += dt * speed;
        placeSatellite();
      }
    },
    dispose() {
      group.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
    }
  };
}
