import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBlueMarbleAtmosphereRuntime } from './blueMarbleAtmosphere.js';

test('active Blue Marble atmosphere creates one thin blue Fresnel limb', () => {
  const surfaceFrame = new THREE.Group();
  const layers = {};
  const runtime = createBlueMarbleAtmosphereRuntime({
    surfaceFrame,
    options: { radius: 600 },
    layers
  });

  runtime.initialize();

  const atmosphere = layers.atmosphere;
  assert.ok(atmosphere?.isMesh);
  assert.equal(atmosphere.name, 'Earth-Blue-Atmosphere');
  assert.equal(atmosphere.geometry.parameters.radius, 600 * 1.018);
  assert.equal(atmosphere.material.transparent, true);
  assert.equal(atmosphere.material.depthWrite, false);
  assert.equal(atmosphere.material.blending, THREE.AdditiveBlending);
  assert.equal(atmosphere.material.uniforms.atmosphereColor.value.getHex(), 0x3d9cff);
  assert.equal(layers.atmosphereVisual.source, 'blue-fresnel-atmosphere');
  assert.equal(surfaceFrame.children.includes(atmosphere), true);

  runtime.dispose();
  assert.equal(surfaceFrame.children.includes(atmosphere), false);
  assert.equal(layers.atmosphere, null);
});
