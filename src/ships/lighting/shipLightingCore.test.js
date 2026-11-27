import test from 'node:test';
import assert from 'node:assert/strict';
import { createShipLightingCore } from './shipLightingCore.js';

test('núcleo cria quatro ramificações independentes e controla luminárias por deck', () => {
  const lighting = createShipLightingCore();
  const initial = lighting.getStatus();
  assert.deepEqual(initial.decks.map(deck => deck.id), ['D1', 'D2', 'D3', 'D4']);
  assert.ok(initial.masterEnabled);
  assert.ok(initial.decks.every(deck => deck.enabled && deck.fixtureCount === 0));

  const d1Fixture = lighting.addWallFixture('D1', { position: [-18, 0, 0] });
  const d2Fixture = lighting.addWallFixture('D2', { position: [18, 0, 0] });
  assert.equal(d1Fixture.userData.deckId, 'D1');
  assert.equal(d2Fixture.userData.deckId, 'D2');

  lighting.setDeckEnabled('D1', false);
  assert.equal(d1Fixture.material.emissiveIntensity, 0);
  assert.equal(d2Fixture.material.emissiveIntensity, 1.15);
  assert.equal(lighting.getStatus().decks[0].enabled, false);
  assert.equal(lighting.getStatus().decks[1].enabled, true);

  lighting.setDeckIntensity('D2', 0.5);
  assert.equal(d2Fixture.material.emissiveIntensity, 0.575);

  lighting.setMasterEnabled(false);
  assert.equal(d2Fixture.material.emissiveIntensity, 0);
  lighting.setMasterEnabled(true);
  assert.equal(d2Fixture.material.emissiveIntensity, 0.575);

  lighting.dispose();
});

test('núcleo rejeita deck inexistente e intensidade fora da faixa', () => {
  const lighting = createShipLightingCore();
  assert.throws(() => lighting.setDeckEnabled('D5', false), /Deck de iluminação desconhecido/);
  assert.throws(() => lighting.setDeckIntensity('D1', 2.1), /intensidade/);
  lighting.dispose();
});
