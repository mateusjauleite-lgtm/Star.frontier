import test from 'node:test';
import assert from 'node:assert/strict';
import { itemDatabase } from './itemDatabase.js';
import { createItemRegistry } from './itemRegistry.js';

test('catálogo registra IDs únicos e permite consulta por categoria', () => {
  assert.ok(itemDatabase.get('tool.mining_drill.basic'));
  assert.equal(itemDatabase.byCategory('tool').length, 3);
  assert.equal(itemDatabase.byCategory('machine').length, 1);
  assert.equal(itemDatabase.get('equipment.backpack.military').attributes.capacity, 40);
  assert.throws(() => createItemRegistry([itemDatabase.get('tool.mining_drill.basic'), itemDatabase.get('tool.mining_drill.basic')]), /duplicado/);
});
