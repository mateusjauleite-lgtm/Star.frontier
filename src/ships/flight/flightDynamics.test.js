import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceShipFlightDynamics } from './flightDynamics.js';

test('ship throttle advances speed and consumes fuel using the gameplay scale', () => {
  const state = {
    speed: 10,
    fuel: 100,
    nitro: 50,
    throttle: true,
    nitroButton: false,
    braking: false
  };

  const boosting = advanceShipFlightDynamics(state, 0.5);

  assert.equal(boosting, false);
  assert.equal(state.speed, 10.72);
  assert.equal(state.fuel, 99.9888);
  assert.equal(state.nitro, 50.48);
});

test('nitro adds acceleration and consumes both nitro and fuel', () => {
  const state = {
    speed: 10,
    fuel: 100,
    nitro: 50,
    throttle: true,
    nitroButton: true,
    braking: false
  };

  const boosting = advanceShipFlightDynamics(state, 0.02);

  assert.equal(boosting, true);
  assert.equal(state.speed, 11.46);
  assert.equal(state.nitro, 49.44);
  assert.equal(state.fuel, 99.9834);
});

test('braking is applied after acceleration and never makes speed negative', () => {
  const state = {
    speed: 0.2,
    fuel: 100,
    nitro: 0,
    throttle: false,
    nitroButton: false,
    braking: true
  };

  advanceShipFlightDynamics(state, 0.04);
  assert.equal(state.speed, 0);
  assert.equal(state.nitro, 0.48);
});

test('flight dynamics clamps large frame deltas and ignores invalid deltas', () => {
  const makeState = () => ({
    speed: 0, fuel: 100, nitro: 100,
    throttle: true, nitroButton: false, braking: false
  });
  const capped = makeState();
  const invalid = makeState();

  advanceShipFlightDynamics(capped, 1);
  advanceShipFlightDynamics(invalid, Number.NaN);

  assert.equal(capped.speed, 0.72);
  assert.equal(capped.fuel, 99.9888);
  assert.equal(invalid.speed, 0);
  assert.equal(invalid.fuel, 100);
});
