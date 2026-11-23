import * as THREE from 'three';
import { RESOURCE_IDS } from '../core/resources/resourceCatalog.js';

export function resolveAsteroidMineralType(asteroid) {
  return Number(asteroid?.userData?.resources?.[RESOURCE_IDS.DILITHIUM_ORE]?.amount) > 0
    ? 'dilithium'
    : 'metal';
}

export function getAsteroidMineralLabel(mineralType) {
  return mineralType === 'dilithium' ? 'DILÍTIO' : 'METAL';
}

function createMineralLabelMaterials() {
  if (typeof document === 'undefined') return null;
  const definitions = {
    metal: { text: 'METAL', background: 'rgba(18, 24, 31, 0.92)', border: '#a9b6c2' },
    dilithium: { text: 'DILÍTIO', background: 'rgba(3, 35, 54, 0.94)', border: '#38d8ff' }
  };
  const materials = {};
  for (const [type, definition] of Object.entries(definitions)) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = definition.background;
    context.strokeStyle = definition.border;
    context.lineWidth = 7;
    context.beginPath();
    context.moveTo(24, 8);
    context.lineTo(488, 8);
    context.quadraticCurveTo(504, 8, 504, 24);
    context.lineTo(504, 104);
    context.quadraticCurveTo(504, 120, 488, 120);
    context.lineTo(24, 120);
    context.quadraticCurveTo(8, 120, 8, 104);
    context.lineTo(8, 24);
    context.quadraticCurveTo(8, 8, 24, 8);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = '#ffffff';
    context.font = 'bold 58px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(definition.text, 256, 66);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    materials[type] = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      sizeAttenuation: true
    });
  }
  return materials;
}

// Campo de mineração separado da Terra. Os rótulos são sprites independentes:
// acompanham a posição do asteroide, mas não herdam sua rotação.
export function createAsteroidField(scene, options = {}) {
  const count = options.count ?? 24;
  const center = options.center ?? [310, 0, -300];
  const spread = options.spread ?? [190, 100, 160];
  const asteroids = [];
  const labels = new Map();
  const labelMaterials = createMineralLabelMaterials();
  const colors = [0x665d56, 0x77716a, 0x4e5962];
  const dilithiumMaterial = new THREE.MeshStandardMaterial({
    color: 0x38d8ff, emissive: 0x087fa8, emissiveIntensity: 1.35,
    metalness: 0.22, roughness: 0.28
  });

  const updateMineralLabel = asteroid => {
    if (!asteroid) return null;
    const mineralType = resolveAsteroidMineralType(asteroid);
    asteroid.userData.mineralType = mineralType;
    asteroid.userData.mineralLabel = getAsteroidMineralLabel(mineralType);
    const label = labels.get(asteroid);
    if (label && labelMaterials?.[mineralType]) {
      label.material = labelMaterials[mineralType];
    }
    return asteroid.userData.mineralLabel;
  };

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
    updateMineralLabel(asteroid);

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
    if (labelMaterials) {
      const label = new THREE.Sprite(labelMaterials[asteroid.userData.mineralType]);
      label.name = `Mineral-Label-${asteroid.userData.mineralType}`;
      label.center.set(0.5, 0);
      label.scale.set(7.2, 1.8, 1);
      label.renderOrder = 10;
      label.userData.asteroidEntityId = asteroid.userData.entityId;
      scene.add(label);
      labels.set(asteroid, label);
    }
    asteroids.push(asteroid);
  }

  const disposeAsteroid = asteroid => {
    scene.remove(asteroid);
    const label = labels.get(asteroid);
    if (label) scene.remove(label);
    labels.delete(asteroid);
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
        const label = labels.get(asteroid);
        if (label) {
          asteroid.getWorldPosition(label.position);
          label.position.y += asteroid.userData.radius + 1.8;
        }
      }
    },
    updateMineralLabel,
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
      for (const material of Object.values(labelMaterials ?? {})) {
        material.map?.dispose?.();
        material.dispose();
      }
      dilithiumMaterial.dispose();
    }
  };
}
