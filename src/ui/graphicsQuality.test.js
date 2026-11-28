import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAPHICS_QUALITY_LEVELS, getGraphicsQualityProfile, normalizeGraphicsQuality } from './graphicsQuality.js';

test('presets gráficos oferecem quatro níveis ordenados', () => {
  assert.deepEqual(GRAPHICS_QUALITY_LEVELS, ['Suave', 'Padrão', 'Alto', 'Ultra']);
});

test('valores antigos continuam compatíveis com os novos perfis', () => {
  assert.equal(normalizeGraphicsQuality('Baixa'), 'Suave');
  assert.equal(normalizeGraphicsQuality('Média'), 'Padrão');
  assert.equal(normalizeGraphicsQuality('Alta'), 'Alto');
});

test('perfil gráfico limita resolução e filtragem progressivamente', () => {
  const profiles = GRAPHICS_QUALITY_LEVELS.map(getGraphicsQualityProfile);
  for (let index = 1; index < profiles.length; index += 1) {
    assert.ok(profiles[index].pixelRatioCap > profiles[index - 1].pixelRatioCap);
    assert.ok(profiles[index].textureAnisotropy > profiles[index - 1].textureAnisotropy);
  }
});
