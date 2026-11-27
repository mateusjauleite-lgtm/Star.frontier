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
  const deflector = ship.visual.getObjectByName('Frontier-Deck3-Primary-Deflector');
  assert.ok(deflector, 'conjunto emissor deve estar instalado na abertura frontal');
  assert.deepEqual(deflector.position.toArray(), [aperture.centerX, aperture.centerY, aperture.centerZ]);
  const outerRing = deflector.getObjectByName('Deflector-Outer-Structural-Ring');
  assert.ok(outerRing, 'aro estrutural do emissor deve existir');
  const outerRadius = outerRing.geometry.parameters.radius + outerRing.geometry.parameters.tube;
  assert.ok(outerRadius * deflector.scale.y < aperture.radiusY,
    'aro elíptico deve permanecer dentro da altura útil da abertura');
  assert.ok(outerRadius < aperture.radiusX,
    'aro estrutural deve permanecer dentro da largura útil da abertura');
  assert.equal(aperture.centerY, -2.9);
  assert.equal(aperture.centerZ, -45);
  assert.ok(aperture.radiusX >= 11, 'abertura deve ter largura útil ampliada');
  assert.ok(aperture.radiusY >= 5, 'abertura deve ter altura útil ampliada');
  assert.ok(aperture.radiusZ >= 9.5, 'abertura deve ter profundidade útil ampliada');
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


test('popa nova tem moldura uniforme e duas naceles longas totalmente externas', () => {
  const ship = createExplorationShip();
  const visual = ship.visual;
  const frame = visual.getObjectByName('Aft-Hangar-Opening-Frame');
  const junction = visual.getObjectByName('Aft-Hangar-Nacelle-Junction');
  assert.ok(frame, 'moldura contínua do hangar deve existir');
  assert.ok(frame.getObjectByName('Central-Hangar-Upper-Lip'));
  assert.ok(frame.getObjectByName('Central-Hangar-Lower-Lip'));
  assert.ok(frame.getObjectByName('Central-Hangar-Port-Frame'));
  assert.ok(frame.getObjectByName('Central-Hangar-Starboard-Frame'));
  assert.equal(visual.getObjectByName('Integrated-Aft-Engineering-Pod'), undefined);
  assert.ok(junction, 'junção externa das naceles deve existir');

  for (const name of ['Port-Warp-Nacelle', 'Starboard-Warp-Nacelle']) {
    const nacelle = visual.getObjectByName(name);
    assert.ok(nacelle, name + ' deve existir');
    assert.ok(Math.abs(nacelle.position.x) > 27.2,
      'o corpo da nacelle deve permanecer além da largura máxima do casco');
    assert.equal(nacelle.userData.exteriorOnly, true);
    const bodyName = name.replace('Warp-Nacelle', 'Nacelle-Armored-Body');
    const body = nacelle.getObjectByName(bodyName);
    assert.ok(body, 'corpo estrutural alongado deve existir');
    assert.ok(body.geometry.parameters.depth >= 60,
      'nacelle deve ser longa no eixo longitudinal');
    assert.ok(nacelle.getObjectByName('Nacelle-Plasma-Channel'));
    assert.ok(nacelle.getObjectByName('Nacelle-Warp-Engine-Core'));
    assert.equal(nacelle.getObjectByName('Port-Nacelle-Root-Collar'), undefined,
      'aros circulares antigos não devem permanecer');
  }

  assert.equal(ship.engineFlames.length, 2);
  assert.equal(ship.engineLights.length, 2);
});
