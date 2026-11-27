import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AURORA_HULL_DIMENSIONS,
  isCharacterInsideAuroraHull
} from './hullCollision.js';

test('dimensões da colisão correspondem à concha elipsoidal da Aurora-7', () => {
  assert.deepEqual(AURORA_HULL_DIMENSIONS, {
    radiusX: 27.2,
    radiusY: 15.2,
    radiusZ: 50
  });
});

test('Deck 1 mantém o personagem dentro do casco e bloqueia a lateral externa', () => {
  assert.equal(isCharacterInsideAuroraHull({ x: 0, z: 0 }, 'D1', 8.91), true);
  assert.equal(isCharacterInsideAuroraHull({ x: 22, z: 0 }, 'D1', 8.91), false);
  assert.equal(isCharacterInsideAuroraHull({ x: 0, z: 40 }, 'D1', 8.91), false);
});

test('Deck 2 respeita o contorno real da concha superior', () => {
  assert.equal(isCharacterInsideAuroraHull({ x: 0, z: 0 }, 'D2', 3.11), true);
  assert.equal(isCharacterInsideAuroraHull({ x: 26.2, z: 0 }, 'D2', 3.11), false);
});

test('Deck 3 respeita o casco inferior e preserva a abertura do defletor', () => {
  assert.equal(isCharacterInsideAuroraHull({ x: 0, z: 0 }, 'D3', -2.69), true);
  assert.equal(isCharacterInsideAuroraHull({ x: 0, z: -45 }, 'D3', -2.69), true);
  assert.equal(isCharacterInsideAuroraHull({ x: 27, z: 0 }, 'D3', -2.69), false);
});

test('Deck 4 bloqueia as laterais e preserva o túnel aberto do hangar', () => {
  assert.equal(isCharacterInsideAuroraHull({ x: 0, z: 0 }, 'D4', -8.49), true);
  assert.equal(isCharacterInsideAuroraHull({ x: 24, z: 0 }, 'D4', -8.49), false);
  assert.equal(isCharacterInsideAuroraHull({ x: 0, z: 41.5 }, 'D4', -8.49), true);
  assert.equal(isCharacterInsideAuroraHull({ x: 0, z: 48 }, 'D4', -8.49), true);
  assert.equal(isCharacterInsideAuroraHull({ x: 0, z: 50.5 }, 'D4', -8.49), false,
    'a contenção do casco deve terminar na borda real da abertura traseira');
  assert.equal(isCharacterInsideAuroraHull({ x: 9.5, z: 41.5 }, 'D4', -8.49), false);
});

test('posições e dimensões inválidas são rejeitadas com segurança', () => {
  assert.equal(isCharacterInsideAuroraHull({ x: NaN, z: 0 }, 'D1', 8.91), false);
  assert.equal(isCharacterInsideAuroraHull({ x: 0, z: 0 }, 'D1', NaN), false);
  assert.equal(isCharacterInsideAuroraHull({ x: 0, z: 0 }, 'D5', 0), false);
});

test('cápsula completa acompanha a curvatura do casco durante um salto', () => {
  // Ao elevar o personagem, a cabeça se aproxima da concha superior
  // e a margem lateral válida diminui em vez de manter um limite fixo.
  assert.equal(isCharacterInsideAuroraHull({ x: 19, z: 0 }, 'D1', 8.91), true);
  assert.equal(isCharacterInsideAuroraHull({ x: 20, z: 0 }, 'D1', 8.91), false);
  assert.equal(isCharacterInsideAuroraHull({ x: 17, z: 0 }, 'D1', 10.0), true);
  assert.equal(isCharacterInsideAuroraHull({ x: 18, z: 0 }, 'D1', 10.0), false);
});
