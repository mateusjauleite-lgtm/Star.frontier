import test from 'node:test';
import assert from 'node:assert/strict';
import { createEarthUpdatePipeline } from './earthUpdatePipeline.js';

const definition = (id, dependsOn = []) => ({
  id, dependsOn, status: 'preview', enabledByDefault: true
});

test('Earth modules attach only after their dependencies', () => {
  const pipeline = createEarthUpdatePipeline([
    definition('surface'),
    definition('terrain', ['surface'])
  ]);
  assert.equal(pipeline.attach('terrain', { initialize() {} }), false);
  assert.equal(pipeline.attach('surface', { initialize() {} }), true);
  assert.equal(pipeline.attach('terrain', { initialize() {} }), true);
  pipeline.dispose();
});

test('failed initialization disposes the failing and previously attached modules in reverse order', () => {
  const disposed = [];
  const pipeline = createEarthUpdatePipeline([
    definition('surface'),
    definition('terrain', ['surface']),
    definition('clouds')
  ]);
  pipeline.attach('surface', { initialize() {}, dispose() { disposed.push('surface'); } });
  pipeline.attach('terrain', { initialize() {}, dispose() { disposed.push('terrain'); } });
  assert.throws(() => pipeline.attach('clouds', {
    initialize() { throw new Error('broken renderer'); },
    dispose() { disposed.push('clouds'); }
  }), /Unable to initialize Earth module "clouds"/);
  assert.deepEqual(disposed, ['clouds', 'terrain', 'surface']);
  assert.equal(pipeline.attach('surface', { initialize() {} }), false);
  pipeline.dispose();
});

test('dispose is idempotent and releases modules in reverse dependency order', () => {
  const disposed = [];
  const pipeline = createEarthUpdatePipeline([
    definition('surface'),
    definition('terrain', ['surface'])
  ]);
  pipeline.attach('surface', { initialize() {}, dispose() { disposed.push('surface'); } });
  pipeline.attach('terrain', { initialize() {}, dispose() { disposed.push('terrain'); } });
  pipeline.dispose();
  pipeline.dispose();
  assert.deepEqual(disposed, ['terrain', 'surface']);
});

test('module definitions must declare dependency arrays and unique ids', () => {
  assert.throws(() => createEarthUpdatePipeline([{ id: 'surface' }]), /dependsOn/);
  assert.throws(() => createEarthUpdatePipeline([
    definition('surface'), definition('surface')
  ]), /unique ids/);
});
