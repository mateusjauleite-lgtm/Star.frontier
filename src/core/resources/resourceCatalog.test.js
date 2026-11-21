import test from 'node:test';
import assert from 'node:assert/strict';
import { RESOURCE_IDS, getResourceDefinition, createResourceEntityData } from './resourceCatalog.js';

test('dilithium ore has a stable canonical resource identity', () => {
  assert.equal(RESOURCE_IDS.DILITHIUM_ORE, 'resource:ore-dilithium');
  const ore = getResourceDefinition(RESOURCE_IDS.DILITHIUM_ORE);
  assert.equal(ore.name, 'Minério bruto de dilítio');
  assert.equal(ore.refinedProductId, RESOURCE_IDS.REFINED_DILITHIUM);
  assert.equal(ore.periodicTableElement, false);
});

test('resource identity can be registered as a serializable world entity', () => {
  const entity = createResourceEntityData(RESOURCE_IDS.DILITHIUM_ORE);
  assert.equal(entity.id, RESOURCE_IDS.DILITHIUM_ORE);
  assert.equal(entity.type, 'resource');
  assert.ok(entity.tags.includes('mineral'));
  assert.equal(entity.metadata.itemId, 'ore.dilithium.raw');
});

test('unknown resource IDs are rejected instead of silently creating entities', () => {
  assert.throws(() => createResourceEntityData('resource:unknown'), /Recurso desconhecido/);
});
