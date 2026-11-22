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
  assert.deepEqual(consoleStation.position.toArray(), [3.35, -2.9, -42.55]);

  interior.dispose();
});
