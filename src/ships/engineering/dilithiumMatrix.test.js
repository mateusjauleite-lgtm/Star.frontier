import assert from 'node:assert/strict';
import test from 'node:test';
import { createDilithiumMatrix, DILITHIUM_MATRIX_LOCAL_POSITION } from './dilithiumMatrix.js';

test('instalação independente da matriz inclui câmara, cristal, reguladores e terminal lateral', () => {
  const matrix = createDilithiumMatrix();
  assert.equal(matrix.name, 'Engineering-Dilithium-Matrix-Installation');
  assert.deepEqual(matrix.position.toArray(), [DILITHIUM_MATRIX_LOCAL_POSITION.x, DILITHIUM_MATRIX_LOCAL_POSITION.y, DILITHIUM_MATRIX_LOCAL_POSITION.z]);
  for (const name of [
    'Matrix-Foundation',
    'Matrix-Containment-Chamber',
    'Matrix-Dilithium-Crystal',
    'Matrix-Regulator-Ring-1',
    'Matrix-Regulator-Ring-2',
    'Matrix-Regulator-Ring-3',
    'Matrix-Terminal-Display',
    'Matrix-EPS-Port-critical',
    'Matrix-EPS-Port-operations',
    'Matrix-EPS-Port-warp'
  ]) assert.ok(matrix.getObjectByName(name), 'elemento ausente: ' + name);
  assert.equal(matrix.userData.footprint.radius, 1.95);
  matrix.traverse(object => {
    if (object.isMesh) {
      object.geometry.dispose();
      if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
      else object.material?.dispose();
    }
  });
});
