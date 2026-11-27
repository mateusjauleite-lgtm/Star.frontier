import * as THREE from 'three';

const DEFAULT_DECKS = [
  { id: 'D1', name: 'Ponte de comando', y: 8.7 },
  { id: 'D2', name: 'Operações e ciência', y: 2.9 },
  { id: 'D3', name: 'Engenharia', y: -2.9 },
  { id: 'D4', name: 'Hangar e apoio', y: -8.7 }
];

const DEFAULT_LIGHT = Object.freeze({
  width: 1.25,
  height: 0.2,
  depth: 0.09,
  color: 0xeaf6ff,
  intensity: 1.15
});

/**
 * Núcleo lógico da iluminação interna da nave.
 * Cada deck possui uma ramificação independente. As luminárias são meshes
 * emissivas (sem PointLight individual) para manter o custo baixo no mobile.
 */
export function createShipLightingCore({ decks = DEFAULT_DECKS } = {}) {
  const group = new THREE.Group();
  group.name = 'Aurora7-Ship-Lighting-Core';

  let masterEnabled = true;
  const branches = new Map();

  for (const deck of decks) {
    const branchGroup = new THREE.Group();
    branchGroup.name = `Aurora7-Lighting-Branch-${deck.id}`;
    branchGroup.userData.deckId = deck.id;
    branchGroup.position.y = deck.y;
    group.add(branchGroup);

    branches.set(deck.id, {
      id: deck.id,
      name: deck.name,
      group: branchGroup,
      enabled: true,
      intensity: 1,
      fixtures: new Set()
    });
  }

  const applyFixtureState = branch => {
    const active = masterEnabled && branch.enabled;
    for (const fixture of branch.fixtures) {
      const material = fixture.material;
      if (!material) continue;
      const materials = Array.isArray(material) ? material : [material];
      for (const item of materials) {
        if (!item?.emissive) continue;
        item.emissiveIntensity = active
          ? fixture.userData.baseEmissiveIntensity * branch.intensity
          : 0;
      }
    }
  };

  const getBranch = deckId => {
    const branch = branches.get(deckId);
    if (!branch) throw new RangeError(`Deck de iluminação desconhecido: ${deckId}`);
    return branch;
  };

  const addWallFixture = (deckId, {
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    width = DEFAULT_LIGHT.width,
    height = DEFAULT_LIGHT.height,
    depth = DEFAULT_LIGHT.depth,
    color = DEFAULT_LIGHT.color,
    intensity = DEFAULT_LIGHT.intensity,
    name,
    geometry = null
  } = {}) => {
    const branch = getBranch(deckId);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: color,
      emissiveIntensity: intensity,
      metalness: 0.15,
      roughness: 0.32
    });
    const fixture = new THREE.Mesh(
      geometry || new THREE.BoxGeometry(width, height, depth),
      material
    );
    fixture.name = name || `${deckId}-Wall-Light-${branch.fixtures.size + 1}`;
    fixture.position.set(...position);
    fixture.rotation.set(...rotation);
    fixture.userData.baseEmissiveIntensity = intensity;
    fixture.userData.deckId = deckId;
    branch.group.add(fixture);
    branch.fixtures.add(fixture);
    applyFixtureState(branch);
    return fixture;
  };

  const setMasterEnabled = enabled => {
    masterEnabled = Boolean(enabled);
    for (const branch of branches.values()) applyFixtureState(branch);
    return masterEnabled;
  };

  const setDeckEnabled = (deckId, enabled) => {
    const branch = getBranch(deckId);
    branch.enabled = Boolean(enabled);
    applyFixtureState(branch);
    return branch.enabled;
  };

  const setDeckIntensity = (deckId, intensity) => {
    const branch = getBranch(deckId);
    const value = Number(intensity);
    if (!Number.isFinite(value) || value < 0 || value > 2) {
      throw new RangeError('A intensidade da iluminação deve ficar entre 0 e 2.');
    }
    branch.intensity = value;
    applyFixtureState(branch);
    return value;
  };

  const getStatus = () => ({
    masterEnabled,
    decks: [...branches.values()].map(branch => ({
      id: branch.id,
      name: branch.name,
      enabled: masterEnabled && branch.enabled,
      branchEnabled: branch.enabled,
      intensity: branch.intensity,
      fixtureCount: branch.fixtures.size
    }))
  });

  const dispose = () => {
    group.traverse(object => {
      if (!object.isMesh) return;
      object.geometry?.dispose();
      if (Array.isArray(object.material)) object.material.forEach(item => item.dispose());
      else object.material?.dispose();
    });
    branches.clear();
  };

  return {
    group,
    addWallFixture,
    setMasterEnabled,
    setDeckEnabled,
    setDeckIntensity,
    getStatus,
    dispose
  };
}
