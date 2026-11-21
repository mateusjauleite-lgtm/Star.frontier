import * as THREE from 'three';
import { RESOURCE_IDS } from '../core/resources/resourceCatalog.js';

// Campo de mineração concentrado em uma região própria, longe da Terra e da estação.
export function createAsteroidField(scene, options = {}) {
  const count = options.count ?? 24;
  const center = options.center ?? [310, 0, -300];
  const spread = options.spread ?? [190, 100, 160];
  const asteroids = [];
  const colors = [0x665d56, 0x77716a, 0x4e5962];
  const dilithiumColor = 0x38d8ff;
  const dilithiumMaterial = new THREE.MeshStandardMaterial({
    color: dilithiumColor, emissive: 0x087fa8, emissiveIntensity: 1.35,
    metalness: 0.22, roughness: 0.28
  });

  for (let i = 0; i < count; i++) {
    const radius = 1.1 + Math.random() * 2.2;
    const asteroid = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius, 0),
      new THREE.MeshStandardMaterial({
        color: colors[i % colors.length], roughness: 1, flatShading: true
      })
    );
    asteroid.position.set(
      center[0] + (Math.random() - 0.5) * spread[0],
      center[1] + (Math.random() - 0.5) * spread[1],
      center[2] + (Math.random() - 0.5) * spread[2]
    );
    asteroid.rotation.set(Math.random() * 3, Math.random() * 3, 0);

    // Depósitos distribuídos de forma previsível para garantir pontos de teste no campo.
    const hasDilithium = i % 4 === 0;
    const dilithiumAmount = hasDilithium ? Math.floor(8 + Math.random() * 15) : 0;
    asteroid.userData = {
      entityId: `asteroid:mining-field:${String(i + 1).padStart(3, '0')}`,
      ore: Math.floor(4 + Math.random() * 12),
      radius,
      resources: hasDilithium ? {
        [RESOURCE_IDS.DILITHIUM_ORE]: { amount: dilithiumAmount, purity: 0.72 + Math.random() * 0.25 }
      } : {}
    };

    if (hasDilithium) {
      const deposit = new THREE.Group();
      deposit.name = 'Dilithium-Ore-Deposit';
      deposit.userData.resourceId = RESOURCE_IDS.DILITHIUM_ORE;
      for (let shard = 0; shard < 3; shard++) {
        const crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.18 + Math.random() * 0.17, 0),
          dilithiumMaterial.clone()
        );
        crystal.position.set(
          (Math.random() - 0.5) * radius * 1.15,
          (Math.random() - 0.5) * radius * 1.15,
          (Math.random() - 0.5) * radius * 1.15
        );
        crystal.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
        deposit.add(crystal);
      }
      asteroid.add(deposit);
    }

    scene.add(asteroid);
    asteroids.push(asteroid);
  }

  const disposeAsteroid = asteroid => {
    scene.remove(asteroid);
    asteroid.traverse(object => {
      if (!object.isMesh) return;
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
      else object.material?.dispose?.();
    });
  };

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
      disposeAsteroid(asteroid);
      asteroids.splice(index, 1);
      return true;
    },
    dispose() {
      for (const asteroid of asteroids) disposeAsteroid(asteroid);
      asteroids.length = 0;
      dilithiumMaterial.dispose();
    }
  };
}
