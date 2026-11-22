import test from 'node:test';
import assert from 'node:assert/strict';
import { createArtificialGravityField } from './artificialGravityField.js';

test('campo interno mantém gravidade vertical durante cruzeiro de dobra', () => {
  const field = createArtificialGravityField({ gravity: 18 });
  field.update(0.04, { speed: 200, warpDriveActive: true, warpTransition: 'cruise' });
  const sample = field.getField([2, 4, 6]);
  assert.deepEqual(sample.position, [2, 4, 6]);
  assert.equal(sample.uniformAcceleration[1], -18);
  assert.equal(sample.warpCompensationActive, true);
});

test('campo compensa aceleração longitudinal sem inverter a gravidade do piso', () => {
  const field = createArtificialGravityField();
  field.update(0.04, { speed: 100, warpTransition: 'entering' });
  const sample = field.update(0.04, { speed: 102, warpTransition: 'entering' });
  const gravity = field.getField();
  assert.ok(sample.longitudinalCompensation > 0);
  assert.equal(gravity.uniformAcceleration[1], -18);
  assert.ok(gravity.uniformAcceleration[2] > 0);
});

test('saída de dobra mantém o campo interno durante a transição', () => {
  const field = createArtificialGravityField();
  const status = field.update(0.04, { speed: 150, warpTransition: 'exiting' });
  assert.equal(status.warpCompensationActive, true);
});
