export const GRAPHICS_QUALITY_LEVELS = Object.freeze([
  'Suave',
  'Padrão',
  'Alto',
  'Ultra'
]);

const LEGACY_QUALITY = Object.freeze({
  'Baixa': 'Suave',
  'Média': 'Padrão',
  'Alta': 'Alto'
});

const PROFILES = Object.freeze({
  Suave: Object.freeze({
    id: 'Suave',
    pixelRatioCap: 0.8,
    textureAnisotropy: 1,
    terrainMaxLevel: 8,
    terrainMaxTiles: 24,
    terrainBuildPerUpdate: 1
  }),
  'Padrão': Object.freeze({
    id: 'Padrão',
    pixelRatioCap: 1.0,
    textureAnisotropy: 2,
    terrainMaxLevel: 10,
    terrainMaxTiles: 32,
    terrainBuildPerUpdate: 1
  }),
  Alto: Object.freeze({
    id: 'Alto',
    pixelRatioCap: 1.35,
    textureAnisotropy: 4,
    terrainMaxLevel: 11,
    terrainMaxTiles: 40,
    terrainBuildPerUpdate: 2
  }),
  Ultra: Object.freeze({
    id: 'Ultra',
    pixelRatioCap: 1.7,
    textureAnisotropy: 8,
    terrainMaxLevel: 12,
    terrainMaxTiles: 48,
    terrainBuildPerUpdate: 2
  })
});

export function normalizeGraphicsQuality(value) {
  if (typeof value !== 'string') return 'Padrão';
  const normalized = LEGACY_QUALITY[value] ?? value;
  return Object.hasOwn(PROFILES, normalized) ? normalized : 'Padrão';
}

export function getGraphicsQualityProfile(value) {
  return PROFILES[normalizeGraphicsQuality(value)];
}
