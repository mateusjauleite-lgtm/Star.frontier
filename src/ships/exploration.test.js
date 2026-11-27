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
    assert.ok(Math.abs(nacelle.position.x) - 2.45 - 0.42 > 27.2,
      'até a face interna do corpo chanfrado deve permanecer além do casco');
    assert.equal(nacelle.userData.exteriorOnly, true);
    assert.ok(nacelle.userData.hullClearanceMeters > 0,
      'a face interna da nacelle deve manter folga positiva do casco');
    const bodyName = name.replace('Warp-Nacelle', 'Nacelle-Armored-Body');
    const body = nacelle.getObjectByName(bodyName);
    assert.ok(body, 'corpo estrutural alongado deve existir');
    assert.ok(body.geometry.parameters.options.depth >= 60,
      'nacelle deve ser longa no eixo longitudinal');
    assert.ok(nacelle.getObjectByName('Nacelle-Plasma-Channel'));
    assert.ok(nacelle.getObjectByName('Nacelle-Warp-Engine-Core'));
    const side = name.startsWith('Port-') ? 'Port' : 'Starboard';
    assert.ok(nacelle.getObjectByName(`${side}-Nacelle-Internal-Plasma-Chamber`),
      'câmara interna de plasma deve existir em cada nacele');
    assert.ok(nacelle.getObjectByName(`${side}-Nacelle-Internal-Chamber-View-Window`),
      'câmara deve ter janela superior visível');
    assert.equal(body.userData.nacelleInspectionSlot, true,
      'blindagem deve conter uma abertura de inspeção real');
    const positions = body.geometry.attributes.position;
    let trianglesInsideInspectionSlot = 0;
    for (let i = 0; i < positions.count; i += 3) {
      const centerX = (positions.getX(i) + positions.getX(i + 1) + positions.getX(i + 2)) / 3;
      const centerZ = (positions.getZ(i) + positions.getZ(i + 1) + positions.getZ(i + 2)) / 3;
      const minimumY = Math.min(positions.getY(i), positions.getY(i + 1), positions.getY(i + 2));
      if (minimumY > 2.45 && Math.abs(centerX - (side === 'Port' ? -1.05 : 1.05)) < 0.66 && Math.abs(centerZ) < 17.8) {
        trianglesInsideInspectionSlot += 1;
      }
    }
    assert.equal(trianglesInsideInspectionSlot, 0,
      'a janela não deve continuar coberta pela face superior da blindagem');
    const feed = junction.getObjectByName(`${side}-Warp-Plasma-Feed-Conduit`);
    assert.ok(feed, 'condutor de plasma deve conectar o braço à nacele');
    assert.equal(feed.userData.isNacellePlasmaConduit, true);
    assert.equal(nacelle.getObjectByName('Port-Nacelle-Root-Collar'), undefined,
      'aros circulares antigos não devem permanecer');
  }

  for (const name of ['Port-External-Aft-Support', 'Starboard-External-Aft-Support']) {
    const support = junction.getObjectByName(name);
    assert.ok(support, 'braço estrutural externo deve existir');
    assert.equal(support.geometry.type, 'BoxGeometry', 'braço não deve voltar a ser tubo');
    assert.equal(support.userData.exteriorOnly, true);
  }

  assert.equal(ship.engineFlames.length, 2);
  assert.equal(ship.engineLights.length, 2);
});
