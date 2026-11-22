import test from 'node:test';
import assert from 'node:assert/strict';
import { createExplorationShip } from './exploration.js';
import { DECK_3_DEFLECTOR_APERTURE, isInsideDeck3DeflectorAperture } from './engineering/deflectorAperture.js';

test('ponte do Deck 1 contém estação física independente do Ship Computer', () => {
  const ship = createExplorationShip();
  const station = ship.visual.getObjectByName('Bridge-Ship-Management-Station');

  assert.ok(station, 'estação física deve existir no modelo 3D da nave');
  assert.deepEqual(station.position.toArray(), [-10.5, 8.91, -20]);
  assert.ok(station.getObjectByName('Management-Station-Floor-Plinth'));
  assert.ok(station.getObjectByName('Management-Station-Worktop'));
  assert.ok(station.getObjectByName('Management-Station-Touch-Display'));
  assert.ok(station.getObjectByName('Management-Station-Emitter-Recess'));
  assert.ok(station.getObjectByName('Management-Station-Emitter-Ring'));
});


test('abertura provisória do defletor recorta somente a concha frontal inferior no Deck 3', () => {
  const ship = createExplorationShip();
  const hull = ship.visual.getObjectByName('Lower-Saucer-Hull');
  assert.ok(hull, 'concha inferior do casco deve existir');

  const aperture = DECK_3_DEFLECTOR_APERTURE;
  assert.equal(aperture.centerY, -2.9);
  assert.equal(aperture.centerZ, -45);
  assert.equal(isInsideDeck3DeflectorAperture(0, aperture.centerY / 15.2, aperture.centerZ / 50), true);

  const geometry = hull.geometry;
  const positions = geometry.attributes.position;
  const indices = geometry.index?.array;
  assert.ok(indices, 'geometria do casco deve permanecer indexada');
  let trianglesOutsideAperture = 0;

  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i];
    const b = indices[i + 1];
    const c = indices[i + 2];
    const x = (positions.getX(a) + positions.getX(b) + positions.getX(c)) / 3;
    const y = (positions.getY(a) + positions.getY(b) + positions.getY(c)) / 3;
    const z = (positions.getZ(a) + positions.getZ(b) + positions.getZ(c)) / 3;
    assert.equal(
      isInsideDeck3DeflectorAperture(x, y, z),
      false,
      'não deve restar triângulo dentro da abertura do defletor'
    );
    trianglesOutsideAperture += 1;
  }

  assert.ok(trianglesOutsideAperture > 0);
});
