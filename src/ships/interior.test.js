import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStarshipInterior } from './interior.js';
import { DECK_3_DEFLECTOR_APERTURE } from './engineering/deflectorAperture.js';

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


test('instala duas faixas emissivas na face interna do casco em cada deck, sem colisões novas', () => {
  const interior = createStarshipInterior();
  const status = interior.lightingCore.getStatus();
  assert.deepEqual(status.decks.map(deck => deck.fixtureCount), [2, 2, 2, 2]);
  assert.deepEqual(status.decks.map(deck => deck.intensity), [1, 1, 1, 1]);

  for (const deck of status.decks) {
    const fixtures = [];
    interior.lightingCore.group.getObjectByName(`Aurora7-Lighting-Branch-${deck.id}`).traverse(object => {
      if (object.isMesh) fixtures.push(object);
    });
    assert.equal(fixtures.length, 2, `${deck.id} deve possuir uma faixa por lateral`);
    assert.ok(fixtures.every(fixture => fixture.userData.wallStrip?.mount === 'inner-hull'));
    assert.ok(fixtures.every(fixture => fixture.userData.wallStrip?.collisionFree === true));
    assert.ok(fixtures.every(fixture => fixture.geometry.attributes.position.count > 300));
  }

  const d1 = interior.lightingCore.group.getObjectByName('Aurora7-Lighting-Branch-D1');
  const d2 = interior.lightingCore.group.getObjectByName('Aurora7-Lighting-Branch-D2');
  const d3 = interior.lightingCore.group.getObjectByName('Aurora7-Lighting-Branch-D3');
  const d4 = interior.lightingCore.group.getObjectByName('Aurora7-Lighting-Branch-D4');
  d1.traverse(object => {
    if (!object.isMesh) return;
    assert.ok(object.userData.wallStrip.zStart > -29,
      'a faixa de D1 deve começar após a borda traseira da janela panorâmica');
  });
  for (const branch of [d2, d3]) {
    branch.traverse(object => {
      if (!object.isMesh) return;
      assert.ok(object.userData.wallStrip.zStart > -35,
        'as faixas de D2/D3 devem começar depois da abertura frontal do defletor');
    });
  }
  d4.traverse(object => {
    if (!object.isMesh) return;
    assert.ok(object.userData.wallStrip.zEnd <= 36,
      'a faixa de D4 deve terminar antes da abertura do hangar/elevador');
  });

  assert.equal(interior.lightingCore.group.userData.collisionBoxesAtInstall, 0,
    'a instalação das faixas não deve registrar caixas de colisão');
  interior.dispose();
});
