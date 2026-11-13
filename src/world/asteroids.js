import * as THREE from 'three';

// Campo de mineração concentrado em uma região própria, longe da Terra e da estação.
export function createAsteroidField(scene, options = {}) {
  const count = options.count ?? 24;
  const center = options.center ?? [310, 0, -300];
  const spread = options.spread ?? [190, 100, 160];
  const asteroids = [];
  const colors = [0x665d56, 0x77716a, 0x4e5962];

  for (let i = 0; i < count; i++) {
    const radius = 1.1 + Math.random() * 2.2;
    const asteroid = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius, 0),
      new THREE.MeshStandardMaterial({
        color: colors[i % colors.length],
        roughness: 1,
        flatShading: true
      })
    );

    asteroid.position.set(
      center[0] + (Math.random() - 0.5) * spread[0],
      center[1] + (Math.random() - 0.5) * spread[1],
      center[2] + (Math.random() - 0.5) * spread[2]
    );
    asteroid.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    asteroid.userData = {
      ore: Math.floor(4 + Math.random() * 12),
      radius
    };

    scene.add(asteroid);
    asteroids.push(asteroid);
  }

  return {
    asteroids,
    update() {
      for (const asteroid of asteroids) {
        asteroid.rotation.x += 0.001;
        asteroid.rotation.y += 0.0015;
      }
    },
    remove(asteroid) {
      const index = asteroids.indexOf(asteroid);
      if (index === -1) return false;
      scene.remove(asteroid);
      asteroid.geometry.dispose();
      asteroid.material.dispose();
      asteroids.splice(index, 1);
      return true;
    },
    dispose() {
      for (const asteroid of asteroids) {
        scene.remove(asteroid);
        asteroid.geometry.dispose();
        asteroid.material.dispose();
      }
      asteroids.length = 0;
    }
  };
}
