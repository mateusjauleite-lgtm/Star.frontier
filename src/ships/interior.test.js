import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStarshipInterior } from './interior.js';
import { DECK_3_DEFLECTOR_APERTURE } from './engineering/deflectorAperture.js';

test('piso do Deck 2 mantém livre a projeção da abertura do defletor na proa', () => {
  const interior = createStarshipInterior();
  const floor = interior.group.getObjectByName('D2-Floor');
  assert.ok(floor, 'piso do Deck 2 deve existir');

  floor.updateMatrixWorld(true);
  const positions = floor.geometry.attributes.position;
  const indices = floor.geometry.index?.array;
  const vertexAt = index => new THREE.Vector3(
    positions.getX(index),
    positions.getY(index),
    positions.getZ(index)
  ).applyMatrix4(floor.matrixWorld);
  const triangleCount = indices ? indices.length / 3 : positions.count / 3;
  const aperture = DECK_3_DEFLECTOR_APERTURE;
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
    const dx = (centerX - aperture.centerX) / aperture.radiusX;
    const dz = (centerZ - aperture.centerZ) / aperture.radiusZ;

    if (dx * dx + dz * dz < 1) intersectingFloorTriangles.push(triangle);
  }

  assert.equal(
    intersectingFloorTriangles.length,
    0,
    'nenhum triângulo horizontal do Deck 2 deve ocupar a abertura do defletor'
  );

  interior.dispose();
});
