import test from 'node:test';
import assert from 'node:assert/strict';
import { createTransporterDispatchBuffer } from './transporterDispatchBuffer.js';

test('destination console stores a complete packet for the platform', () => {
  const buffer = createTransporterDispatchBuffer();
  const packet = buffer.queue({
    id: 'bt-01', name: 'Base Terrestre BT-01', bodyId: 'earth',
    latitudeDeg: -22.29, longitudeDeg: -48.56, elevationMeters: 520
  });
  assert.equal(buffer.getStatus(), 'queued');
  assert.deepEqual(buffer.getPending(), packet);
  assert.equal(packet.destinationId, 'bt-01');
  assert.equal(packet.latitudeDeg, -22.29);
  assert.equal(packet.longitudeDeg, -48.56);
  assert.equal(packet.status, 'queued');
});

test('platform consumes only the latest queued destination and clears after execution', () => {
  const buffer = createTransporterDispatchBuffer();
  buffer.queue({ id: 'old', latitudeDeg: 0, longitudeDeg: 0 });
  const latest = buffer.queue({ id: 'new', latitudeDeg: 1, longitudeDeg: 2 });
  assert.equal(buffer.getPending().destinationId, 'new');
  assert.equal(buffer.clear().sequence, latest.sequence);
  assert.equal(buffer.getStatus(), 'empty');
  assert.equal(buffer.getPending(), null);
});

test('rejects an unregistered destination without replacing a valid queued packet', () => {
  const buffer = createTransporterDispatchBuffer();
  const queued = buffer.queue({ id: 'valid', latitudeDeg: 0, longitudeDeg: 0 });
  assert.throws(() => buffer.queue({ name: 'Sem ID' }), /registered ID/);
  assert.equal(buffer.getPending(), queued);
});
