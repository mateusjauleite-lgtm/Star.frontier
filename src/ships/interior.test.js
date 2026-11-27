import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStarshipInterior } from './interior.js';
import { DECK_3_DEFLECTOR_APERTURE } from './engineering/deflectorAperture.js';

const isPointInsidePolygon = (point, polygon) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = ((a.y > point.y) !== (b.y > point.y)) &&
      (point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x);
    if (crosses) inside = !inside;
  }
  return inside;
};

test('pisos dos Decks 2 e 3 mantêm livre o volume estrutural do defletor na proa', () => {
  const interior = createStarshipInterior();
  const aperture = DECK_3_DEFLECTOR_APERTURE;
  const deckClearances = [
    { name: 'D2-Floor', radiusX: aperture.radiusX, radiusZ: aperture.radiusZ },
    { name: 'D3-Floor', radiusX: 9.35, radiusZ: 6.25 }
  ];

  for (const clearance of deckClearances) {
    const floor = interior.group.getObjectByName(clearance.name);
    assert.ok(floor, `piso ${clearance.name} deve existir`);
    floor.updateMatrixWorld(true);
    const positions = floor.geometry.attributes.position;
    const indices = floor.geometry.index?.array;
    const vertexAt = index => new THREE.Vector3(
      positions.getX(index),
      positions.getY(index),
      positions.getZ(index)
    ).applyMatrix4(floor.matrixWorld);
    const triangleCount = indices ? indices.length / 3 : positions.count / 3;
    const intersectingFloorTriangles = [];

    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      const ids = indices
        ? [indices[triangle * 3], indices[triangle * 3 + 1], indices[triangle * 3 + 2]]
        : [triangle * 3, triangle * 3 + 1, triangle * 3 + 2];
      const vertices = ids.map(vertexAt);
      const horizontalFace = vertices.every(vertex =>
        Math.abs(vertex.y - vertices[0].y) < 1e-5
      );
      if (!horizontalFace) continue;

      const centerX = vertices.reduce((sum, vertex) => sum + vertex.x, 0) / 3;
      const centerZ = vertices.reduce((sum, vertex) => sum + vertex.z, 0) / 3;
      const dx = (centerX - aperture.centerX) / clearance.radiusX;
      const dz = (centerZ - aperture.centerZ) / clearance.radiusZ;

      if (dx * dx + dz * dz < 1) intersectingFloorTriangles.push(triangle);
    }

    assert.equal(
      intersectingFloorTriangles.length,
      0,
      `nenhum triângulo horizontal de ${clearance.name} deve ocupar a abertura do defletor`
    );
  }

  interior.dispose();
});


test('estrutura interna do defletor integra anel iluminado e acesso pelo Deck 3', () => {
  const interior = createStarshipInterior();
  const structure = interior.group.getObjectByName('Deck3-Deflector-Interior-Structure');
  assert.ok(structure, 'estrutura interna do defletor deve estar instalada');

  const collar = structure.getObjectByName('Deflector-Interior-Collar-Assembly');
  assert.ok(collar, 'colar estrutural deve acompanhar o anel frontal');
  assert.ok(collar.getObjectByName('Deflector-Interior-Black-Collar-Front'));
  assert.ok(collar.getObjectByName('Deflector-Interior-Black-Collar-Rear'));

  const ringLights = [];
  collar.traverse(object => {
    if (object.name.startsWith('Deflector-Interior-Ring-Light-')) ringLights.push(object);
  });
  assert.equal(ringLights.length, 24, 'anel deve ter 24 luzes distribuídas ao redor');

  const access = structure.getObjectByName('Deck3-Deflector-Maintenance-Access');
  assert.ok(access, 'passarela de manutenção deve ligar o Deck 3 ao defletor');
  assert.ok(access.getObjectByName('Deflector-Access-Catwalk'));
  assert.ok(access.getObjectByName('Deflector-Access-Deck3-Entry-Header'));
  assert.equal(structure.userData.depth, 1.5);

  const consoleStation = structure.getObjectByName('Deflector-Interior-Computer-Console');
  assert.ok(consoleStation, 'console deve ficar dentro da câmara do defletor');
  assert.equal(consoleStation.parent, structure, 'console não deve ser instalado como mobiliário do piso geral');
  assert.ok(consoleStation.getObjectByName('Deflector-Console-Ship-Computer-Display'));
  assert.ok(consoleStation.getObjectByName('Deflector-Console-Computer-Link-Light'));
  assert.deepEqual(consoleStation.position.toArray(), [4.3, -2.9, -43]);

  interior.dispose();
});


test('Deck 1 é mais estreito; Decks 2 e 3 ampliados iguais; Deck 4 preservado', () => {
  const interior = createStarshipInterior();
  const expectedFootprints = {
    D1: { width: 44, length: 82, centerZ: -2 },
    D2: { width: 52, length: 96, centerZ: -2 },
    D3: { width: 52, length: 96, centerZ: -2 }
  };

  for (const [deckId, expected] of Object.entries(expectedFootprints)) {
    const floor = interior.group.getObjectByName(`${deckId}-Floor`);
    assert.ok(floor, `piso ${deckId} deve existir`);
    assert.deepEqual(floor.userData.deckFootprint, expected);
  }

  const deck4 = interior.group.getObjectByName('D4-Floor');
  assert.ok(deck4, 'piso D4 deve continuar instalado');
  assert.deepEqual(deck4.userData.deckFootprint, { width: 48, length: 98, centerZ: 0 });

  interior.dispose();
});


test('Deck 4 afunila na popa e reserva o poço do elevador na entrada do hangar', () => {
  const interior = createStarshipInterior();
  const floor = interior.group.getObjectByName('D4-Floor');
  const ceiling = interior.group.getObjectByName('D3-Floor');
  assert.ok(floor);
  assert.ok(ceiling, 'o piso do D3 também forma o teto estrutural do hangar D4');
  floor.updateMatrixWorld(true);
  const positions = floor.geometry.attributes.position;
  const aftVertices = [];
  for (let index = 0; index < positions.count; index += 1) {
    const vertex = new THREE.Vector3(
      positions.getX(index), positions.getY(index), positions.getZ(index)
    ).applyMatrix4(floor.matrixWorld);
    if (vertex.z >= 40) aftVertices.push(vertex);
  }
  assert.ok(aftVertices.length > 0, 'piso deve alcançar a entrada traseira do hangar');
  assert.ok(Math.max(...aftVertices.map(vertex => Math.abs(vertex.x))) <= 13.5,
    'a popa do piso deve afunilar para acompanhar o casco');
  assert.deepEqual(floor.userData.deckFootprint, { width: 48, length: 98, centerZ: 0 });

  ceiling.updateMatrixWorld(true);
  const ceilingPositions = ceiling.geometry.attributes.position;
  const ceilingAft = [];
  for (let index = 0; index < ceilingPositions.count; index += 1) {
    const vertex = new THREE.Vector3(
      ceilingPositions.getX(index), ceilingPositions.getY(index), ceilingPositions.getZ(index)
    ).applyMatrix4(ceiling.matrixWorld);
    if (vertex.z >= 40) ceilingAft.push(vertex);
  }
  assert.ok(ceilingAft.length > 0);
  assert.ok(Math.max(...ceilingAft.map(vertex => Math.abs(vertex.x))) <= 12.5,
    'o teto do hangar deve acompanhar o afunilamento da popa');
  interior.dispose();
});


test('instala duas faixas emissivas sobre o piso real de cada deck, sem colisões novas', () => {
  const interior = createStarshipInterior();
  const status = interior.lightingCore.getStatus();
  assert.deepEqual(status.decks.map(deck => deck.fixtureCount), [2, 2, 2, 2]);
  assert.deepEqual(status.decks.map(deck => deck.intensity), [1, 1, 1, 1]);

  for (const deck of status.decks) {
    const floor = interior.group.getObjectByName(`${deck.id}-Floor`);
    assert.ok(floor, `piso ${deck.id} deve existir`);
    const contour = floor.userData.floorContour.map(([x, z]) => new THREE.Vector2(x, z));
    const centerZ = floor.userData.deckFootprint.centerZ;
    const branch = interior.lightingCore.group.getObjectByName(`Aurora7-Lighting-Branch-${deck.id}`);
    const fixtures = [];
    branch.traverse(object => { if (object.isMesh) fixtures.push(object); });
    assert.equal(fixtures.length, 2, `${deck.id} deve possuir uma faixa em cada lateral`);

    for (const fixture of fixtures) {
      const strip = fixture.userData.floorStrip;
      assert.equal(strip?.mount, 'floor');
      assert.equal(strip?.collisionFree, true);
      assert.equal(strip?.edgeInset, 3.2);
      assert.ok(fixture.name.includes('Floor-Light'));
      assert.ok(fixture.geometry.attributes.position.count > 300,
        'cada faixa deve ser uma malha contínua de baixa complexidade');

      const positions = fixture.geometry.attributes.position;
      for (let index = 0; index < positions.count; index += 1) {
        const x = positions.getX(index);
        const y = positions.getY(index);
        const z = positions.getZ(index);
        assert.ok(Math.abs(y - 0.205) < 1e-6,
          'a faixa deve ficar apenas 2,5 cm acima da superfície do piso');
        assert.ok(isPointInsidePolygon(new THREE.Vector2(x, z - centerZ), contour), `${deck.id} faixa deve permanecer dentro do contorno real do piso`);
      }
    }
  }

  const d1 = interior.lightingCore.group.getObjectByName('Aurora7-Lighting-Branch-D1');
  const d2 = interior.lightingCore.group.getObjectByName('Aurora7-Lighting-Branch-D2');
  const d3 = interior.lightingCore.group.getObjectByName('Aurora7-Lighting-Branch-D3');
  const d4 = interior.lightingCore.group.getObjectByName('Aurora7-Lighting-Branch-D4');
  d1.traverse(object => {
    if (object.isMesh) assert.ok(object.userData.floorStrip.zStart > -29,
      'D1 mantém livre a região da janela panorâmica');
  });
  for (const branch of [d2, d3]) {
    branch.traverse(object => {
      if (object.isMesh) assert.ok(object.userData.floorStrip.zStart > -35,
        'D2/D3 mantêm livre a abertura frontal do defletor');
    });
  }
  d4.traverse(object => {
    if (object.isMesh) assert.ok(object.userData.floorStrip.zEnd <= 36,
      'D4 termina antes da abertura do hangar/elevador');
  });

  assert.equal(interior.lightingCore.group.userData.collisionBoxesAtInstall, 0,
    'as faixas do piso não devem registrar caixas de colisão');

  const d1Branch = interior.lightingCore.group.getObjectByName('Aurora7-Lighting-Branch-D1');
  const d1Fixture = d1Branch.children.find(object => object.isMesh);
  assert.ok(d1Fixture, 'o núcleo deve manter referência direta à faixa física do piso');
  assert.equal(d1Fixture.material.emissiveIntensity, 1.15);
  interior.lightingCore.setDeckIntensity('D1', 0.5);
  assert.equal(d1Fixture.material.emissiveIntensity, 0.575,
    'o controle de intensidade deve alterar a faixa real do piso');
  interior.lightingCore.setDeckEnabled('D1', false);
  assert.equal(d1Fixture.material.emissiveIntensity, 0,
    'o interruptor individual deve apagar a faixa real');
  interior.lightingCore.setDeckEnabled('D1', true);
  interior.lightingCore.setMasterEnabled(false);
  assert.equal(d1Fixture.material.emissiveIntensity, 0,
    'o interruptor mestre deve apagar todas as faixas');
  interior.lightingCore.setMasterEnabled(true);
  assert.equal(d1Fixture.material.emissiveIntensity, 0.575,
    'ao religar o mestre, a intensidade individual deve ser preservada');
  interior.dispose();
});
