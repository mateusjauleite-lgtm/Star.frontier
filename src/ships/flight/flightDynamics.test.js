import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceShipFlightDynamics, WARP_STAGE_SPEEDS } from './flightDynamics.js';

function makeState(overrides = {}) {
  return {
    speed: 10,
    fuel: 100,
    refinedDilithium: 100,
    warpDilithiumConsumedTotal: 0,
    throttle: false,
    braking: false,
    warpDriveButton: false,
    warpDriveActive: false,
    warpStage: 5,
    warpCurrentStage: 0,
    warpTargetSpeed: 0,
    warpTransition: 'idle',
    warpExitMode: 'smooth',
    ...overrides
  };
}

test('aceleração convencional continua independente e consome combustível comum', () => {
  const state = makeState({ throttle: true });
  assert.equal(advanceShipFlightDynamics(state, 0.5), false);
  assert.equal(state.speed, 10.72);
  assert.equal(state.fuel, 99.9888);
  assert.equal(state.refinedDilithium, 100);
  assert.equal(state.warpDilithiumConsumedTotal, 0);
});

test('ativar dobra inicia no estágio 5 e acelera progressivamente sem consumir combustível comum', () => {
  const state = makeState({ speed: 10, warpDriveButton: true });
  assert.equal(advanceShipFlightDynamics(state, 0.02), true);
  assert.equal(state.warpCurrentStage, 5);
  assert.equal(state.warpTargetSpeed, WARP_STAGE_SPEEDS[5]);
  assert.equal(state.speed, 11.3);
  assert.equal(state.fuel, 100);
  assert.ok(state.refinedDilithium < 100);
  assert.ok(state.warpDilithiumConsumedTotal > 0);
  assert.equal(state.warpTransition, 'entering');
});

test('selecionar um estágio inferior mantém a velocidade e muda o alvo progressivamente', () => {
  const state = makeState({ speed: 200, warpDriveButton: true, warpStage: 2 });
  advanceShipFlightDynamics(state, 0.02);
  assert.equal(state.warpCurrentStage, 2);
  assert.equal(state.warpTargetSpeed, WARP_STAGE_SPEEDS[2]);
  assert.equal(state.speed, 198.7);
  assert.equal(state.warpDriveActive, true);
});

test('acelerador convencional continua independente durante a dobra', () => {
  const state = makeState({ speed: 155, warpDriveButton: true, warpStage: 2, throttle: true });
  const initialFuel = state.fuel;
  advanceShipFlightDynamics(state, 0.04);
  assert.ok(state.speed > 155);
  assert.ok(state.fuel < initialFuel);
});

test('dobra mantém cruzeiro e consome dilítio continuamente por estágio', () => {
  const state = makeState({ speed: 155, warpDriveButton: true, warpStage: 2 });
  advanceShipFlightDynamics(state, 0.04);
  const afterFirstFrame = state.refinedDilithium;
  advanceShipFlightDynamics(state, 0.04);
  assert.ok(state.refinedDilithium < afterFirstFrame);
  assert.equal(state.speed, 155);
  assert.equal(state.warpTransition, 'cruise');
});

test('esgotamento de dilítio inicia desligamento seguro da dobra', () => {
  const state = makeState({ speed: 180, refinedDilithium: 0.0001, warpDriveButton: true, warpStage: 5 });
  assert.equal(advanceShipFlightDynamics(state, 0.04), false);
  assert.equal(state.warpDriveButton, false);
  assert.equal(state.warpDriveActive, false);
  assert.equal(state.warpTransition, 'exiting');
  assert.equal(state.warpShutdownReason, 'dilithium-depleted');
  assert.ok(state.speed > 0);
});

test('saída suave reduz a velocidade sem interromper o movimento', () => {
  const state = makeState({ speed: 200, warpDriveActive: true, warpDriveButton: false, warpTransition: 'cruise' });
  advanceShipFlightDynamics(state, 0.04);
  assert.equal(state.speed, 199.04);
  assert.equal(state.warpTransition, 'exiting');
});

test('acelerador convencional não transforma uma saída suave em corte instantâneo', () => {
  const state = makeState({
    speed: 200,
    fuel: 100,
    throttle: true,
    warpDriveActive: true,
    warpDriveButton: false,
    warpTransition: 'cruise',
    warpExitMode: 'smooth'
  });
  advanceShipFlightDynamics(state, 0.04);
  assert.equal(state.speed, 199.04);
  assert.ok(state.fuel < 100);
  assert.equal(state.warpTransition, 'exiting');
});

test('saída direta retorna à velocidade convencional sem zerar o deslocamento', () => {
  const state = makeState({ speed: 300, warpDriveActive: true, warpDriveButton: false, warpTransition: 'cruise', warpExitMode: 'direct' });
  advanceShipFlightDynamics(state, 0.04);
  assert.equal(state.speed, 75);
  assert.equal(state.warpTransition, 'idle');
});

test('frenagem nunca produz velocidade negativa e deltas grandes são limitados', () => {
  const state = makeState({ speed: 0.2, braking: true });
  advanceShipFlightDynamics(state, 1);
  assert.equal(state.speed, 0);
});


test('dobra integrada consome EPS do barramento sem consumir dilítio diretamente', () => {
  let requested = 0;
  const state = makeState({
    warpDriveButton: true,
    warpCorePowerBusConnected: true,
    requestWarpPower: amount => { requested = amount; return amount; }
  });
  assert.equal(advanceShipFlightDynamics(state, 0.02), true);
  assert.equal(requested, 7.5 * 0.02);
  assert.equal(state.refinedDilithium, 100);
});

test('falta de potência no barramento aborta entrada em dobra com desligamento seguro', () => {
  const state = makeState({
    speed: 40,
    warpDriveButton: true,
    warpCorePowerBusConnected: true,
    requestWarpPower: () => 0
  });
  assert.equal(advanceShipFlightDynamics(state, 0.02), false);
  assert.equal(state.warpDriveButton, false);
  assert.equal(state.warpDriveActive, false);
  assert.equal(state.warpShutdownReason, 'insufficient-warp-power');
  assert.equal(state.warpTransition, 'idle');
  assert.equal(state.refinedDilithium, 100);
});
