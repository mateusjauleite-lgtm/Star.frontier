import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRAPHICS_QUALITY_LEVELS,
  getGraphicsQualityProfile,
  normalizeGraphicsQuality
} from './graphicsQuality.js';

test('exposes the four ordered graphics presets', () => {
  assert.deepEqual(GRAPHICS_QUALITY_LEVELS, ['Suave', 'Padrão', 'Alto', 'Ultra']);
});

test('maps saved legacy quality values without losing player settings', () => {
  assert.equal(normalizeGraphicsQuality('Baixa'), 'Suave');
  assert.equal(normalizeGraphicsQuality('Média'), 'Padrão');
  assert.equal(normalizeGraphicsQuality('Alta'), 'Alto');
});

test('falls back safely for unknown quality values', () => {
  assert.equal(normalizeGraphicsQuality('desconhecida'), 'Padrão');
  assert.equal(normalizeGraphicsQuality(null), 'Padrão');
});

test('higher presets increase render budget and texture detail', () => {
  const suave = getGraphicsQualityProfile('Suave');
  const padrao = getGraphicsQualityProfile('Padrão');
  const alto = getGraphicsQualityProfile('Alto');
  const ultra = getGraphicsQualityProfile('Ultra');
  assert.ok(suave.pixelRatioCap < padrao.pixelRatioCap);
  assert.ok(padrao.pixelRatioCap < alto.pixelRatioCap);
  assert.ok(alto.pixelRatioCap < ultra.pixelRatioCap);
  assert.ok(suave.terrainMaxTiles < padrao.terrainMaxTiles);
  assert.ok(padrao.terrainMaxTiles < alto.terrainMaxTiles);
  assert.ok(alto.terrainMaxTiles < ultra.terrainMaxTiles);
  assert.ok(suave.textureAnisotropy < ultra.textureAnisotropy);
});
