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
    warpSpeedC: 0,
    warpStage: 5,
    warpCurrentStage: 0,
    warpTargetSpeed: 0,
    warpTransition: 'idle',
    warpExitMode: 'smooth',
    conventionalSpeedLimit: 12000,
    ...overrides
  };
}

test('propulsor principal acelera em m/s e consome combustível comum', () => {
  const state = makeState({ throttle: true, speed: 10 });
  advanceShipFlightDynamics(state, 0.04);
  assert.equal(state.speed, 130);
  assert.ok(state.fuel < 100);
  assert.equal(state.refinedDilithium, 100);
});

test('aceleração de teste é 3000 m/s² sem alterar o teto de 12000 m/s', () => {
  const state = makeState({ throttle: true, speed: 0, conventionalSpeedLimit: 12000 });
  advanceShipFlightDynamics(state, 0.04);
  assert.equal(state.speed, 120);
  advanceShipFlightDynamics(state, 0.04);
  assert.equal(state.speed, 240);
  state.speed = 11950;
  advanceShipFlightDynamics(state, 0.04);
  assert.equal(state.speed, 12000);
});

test('propulsor travado desliga ao esgotar combustível e a nave volta a desacelerar', () => {
  const state = makeState({ throttle: true, fuel: 0, speed: 10 });
  advanceShipFlightDynamics(state, 0.04);
  assert.equal(state.throttle, false);
  assert.equal(state.throttleShutdownReason, 'fuel-depleted');
  assert.ok(state.speed < 10);
});

test('limite de aproximação prevalece sobre o limite de espaço aberto', () => {
  const state = makeState({ throttle: true, speed: 55, conventionalSpeedLimit: 60 });
  advanceShipFlightDynamics(state, 0.04);
  assert.equal(state.speed, 60);
});

test('dobra usa múltiplos de c e mantém velocidade convencional independente', () => {
  const state = makeState({ speed: 0, warpDriveButton: true, warpStage: 5 });
  assert.equal(advanceShipFlightDynamics(state, 0.04), true);
  assert.equal(state.warpCurrentStage, 5);
  assert.equal(state.warpTargetSpeed, WARP_STAGE_SPEEDS[5]);
  assert.equal(state.warpSpeedC, 10);
  assert.equal(state.speed, 0);
  assert.ok(state.refinedDilithium < 100);
});

test('selecionar estágio inferior reduz o alvo em c sem alterar m/s convencional', () => {
  const state = makeState({ speed: 42, warpDriveButton: true, warpStage: 2, warpSpeedC: 25 });
  advanceShipFlightDynamics(state, 0.04);
  assert.equal(state.warpTargetSpeed, 5);
  assert.equal(state.warpSpeedC, 15);
  assert.equal(state.speed, 42);
});

test('dobra não inicia dentro do envelope gravitacional de pouso', () => {
  const state = makeState({ warpDriveButton: true, warpSafetyLock: true });
  assert.equal(advanceShipFlightDynamics(state, 0.04), false);
  assert.equal(state.warpDriveButton, false);
  assert.equal(state.warpShutdownReason, 'planetary-proximity');
  assert.equal(state.warpSpeedC, 0);
});

test('saída suave desacelera o campo de dobra sem tocar na velocidade convencional', () => {
  const state = makeState({ speed: 120, warpSpeedC: 25, warpDriveActive: true, warpTransition: 'cruise' });
  advanceShipFlightDynamics(state, 0.04);
  assert.equal(state.warpSpeedC, 15);
  assert.equal(state.warpTransition, 'exiting');
  assert.equal(state.speed, 120);
});

test('esgotamento de dilítio inicia desligamento seguro', () => {
  const state = makeState({ refinedDilithium: 0.0001, warpDriveButton: true, warpStage: 5 });
  assert.equal(advanceShipFlightDynamics(state, 0.04), false);
  assert.equal(state.warpDriveButton, false);
  assert.equal(state.warpDriveActive, false);
  assert.equal(state.warpTransition, 'exiting');
  assert.equal(state.warpShutdownReason, 'dilithium-depleted');
});

test('falta de potência no barramento aborta a dobra', () => {
  const state = makeState({
    warpDriveButton: true,
    warpCorePowerBusConnected: true,
    requestWarpPower: () => 0
  });
  assert.equal(advanceShipFlightDynamics(state, 0.02), false);
  assert.equal(state.warpDriveButton, false);
  assert.equal(state.warpShutdownReason, 'insufficient-warp-power');
});

test('freio de alto empuxo nunca produz velocidade negativa', () => {
  const state = makeState({ speed: 5, braking: true });
  advanceShipFlightDynamics(state, 0.04);
  assert.equal(state.speed, 0);
});
