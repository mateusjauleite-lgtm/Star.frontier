import test from 'node:test';
import assert from 'node:assert/strict';
import { EntityManager } from './EntityManager.js';

function createManager() {
  let nextId = 0;
  const events = [];
  const manager = new EntityManager({
    idFactory: () => `test-${++nextId}`,
    eventEmitter: (name, payload) => events.push({ name, payload })
  });
  return { manager, events };
}

test('creates entities with stable unique ids and queries them', () => {
  const { manager } = createManager();
  const ship = manager.create({ type: 'ship', name: 'Explorer', tags: ['player'] });
  const crew = manager.create({ type: 'character', name: 'Pilot' });
  assert.equal(ship.id, 'test-1');
  assert.equal(manager.get(ship.id), ship);
  assert.equal(manager.has(crew.id), true);
  assert.deepEqual(manager.list({ type: 'ship', tag: 'player' }), [ship]);
});

test('rejects duplicate ids and immutable identity changes', () => {
  const { manager } = createManager();
  const entity = manager.create({ id: 'ship-1', type: 'ship' });
  assert.throws(() => manager.create({ id: 'ship-1', type: 'ship' }), /Já existe/);
  assert.throws(() => manager.update(entity.id, { id: 'ship-2' }), /imutável/);
  assert.throws(() => manager.update(entity.id, { type: 'station' }), /imutável/);
});

test('handles lifecycle transitions and rejects invalid transitions', () => {
  const { manager } = createManager();
  const entity = manager.create({ type: 'npc' });
  manager.activate(entity.id);
  assert.equal(entity.status, 'active');
  manager.deactivate(entity.id);
  assert.equal(entity.status, 'inactive');
  manager.destroy(entity.id);
  assert.equal(entity.status, 'destroyed');
  assert.throws(() => manager.activate(entity.id), /não permitida/);
});

test('manages relationships and cleans them up when an entity is removed', () => {
  const { manager } = createManager();
  const ship = manager.create({ type: 'ship' });
  const crew = manager.create({ type: 'character' });
  assert.equal(manager.relate(crew.id, 'member-of', ship.id), true);
  assert.equal(manager.relate(crew.id, 'member-of', ship.id), false);
  assert.equal(manager.relations.getFrom(crew.id, 'member-of').length, 1);
  assert.equal(manager.remove(ship.id), true);
  assert.equal(manager.relations.getFrom(crew.id).length, 0);
});

test('exports and imports snapshots without sharing metadata references', () => {
  const { manager } = createManager();
  const ship = manager.create({ id: 'ship', type: 'ship', metadata: { fuel: 90 } });
  const crew = manager.create({ id: 'crew', type: 'character' });
  manager.relate('crew', 'assigned-to', 'ship', { deck: 2 });
  const snapshot = manager.exportSnapshot();
  const restored = new EntityManager({ idFactory: () => 'unused', eventEmitter: () => {} });
  assert.equal(restored.importSnapshot(snapshot), 2);
  assert.equal(restored.get('ship').metadata.fuel, 90);
  assert.equal(restored.relations.getFrom('crew')[0].metadata.deck, 2);
  snapshot.entities[0].metadata.fuel = 0;
  assert.equal(ship.metadata.fuel, 90);
});

test('emits lifecycle, mutation and removal events', () => {
  const { manager, events } = createManager();
  const entity = manager.create({ type: 'asteroid' });
  manager.update(entity.id, { name: 'Rock' });
  manager.activate(entity.id);
  manager.remove(entity.id);
  assert.deepEqual(events.map(event => event.name), [
    'entity:created', 'entity:updated', 'entity:status-changed', 'entity:removed'
  ]);
});
