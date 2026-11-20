import test from 'node:test';
import assert from 'node:assert/strict';
import { Entity } from './Entity.js';

test('entity update validates all fields before committing any mutation', () => {
  const entity = new Entity({
    id: 'ship-1',
    type: 'ship',
    name: 'Explorer',
    status: 'created',
    tags: ['player'],
    metadata: { fuel: 90 }
  });
  const before = entity.toJSON();
  const cyclicMetadata = {};
  cyclicMetadata.self = cyclicMetadata;

  assert.throws(() => entity.update({
    name: 'Renamed',
    status: 'active',
    tags: ['player', 'crew'],
    metadata: cyclicMetadata
  }));

  assert.deepEqual(entity.toJSON(), before);
});
