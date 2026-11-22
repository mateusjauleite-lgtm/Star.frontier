import test from 'node:test';
import assert from 'node:assert/strict';
import { createDilithiumRefineryKernel } from './dilithiumRefineryKernel.js';

test('buffer refinado pode abastecer o núcleo mesmo com o processador desligado no fallback', () => {
  const kernel = createDilithiumRefineryKernel();
  const result = kernel.step({
    deltaSeconds: 0.1,
    rawOre: 0,
    refinedBuffer: 5,
    sharedCore: 20,
    rawCapacity: 200,
    refinedCapacity: 120,
    coreCapacity: 250,
    refiningRate: 0.08,
    transferRate: 2,
    refineryEnabled: false,
    transferEnabled: true
  });
  assert.equal(result.rawOre, 0);
  assert.equal(result.refinedBuffer, 4.8);
  assert.equal(result.sharedCore, 20.2);
  assert.equal(result.transferred, 0.2);
  kernel.dispose();
});
