export const GRAPHICS_QUALITY_LEVELS = Object.freeze(['Suave', 'Padrão', 'Alto', 'Ultra']);

const LEGACY_QUALITY = Object.freeze({
  'Baixa': 'Suave',
  'Média': 'Padrão',
  'Alta': 'Alto'
});

const PROFILES = Object.freeze({
  Suave: Object.freeze({ id: 'Suave', pixelRatioCap: 0.8, textureAnisotropy: 1 }),
  'Padrão': Object.freeze({ id: 'Padrão', pixelRatioCap: 1.0, textureAnisotropy: 2 }),
  Alto: Object.freeze({ id: 'Alto', pixelRatioCap: 1.25, textureAnisotropy: 4 }),
  Ultra: Object.freeze({ id: 'Ultra', pixelRatioCap: 1.5, textureAnisotropy: 8 })
});

export function normalizeGraphicsQuality(value) {
  if (typeof value !== 'string') return 'Padrão';
  const normalized = LEGACY_QUALITY[value] ?? value;
  return Object.hasOwn(PROFILES, normalized) ? normalized : 'Padrão';
}

export function getGraphicsQualityProfile(value) {
  return PROFILES[normalizeGraphicsQuality(value)];
}
