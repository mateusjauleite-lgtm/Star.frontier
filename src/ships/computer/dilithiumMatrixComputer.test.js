import assert from 'node:assert/strict';
import test from 'node:test';
import { createShipComputer } from './shipComputer.js';
import { registerShipComputerSystems } from './shipComputerSystems.js';

function setup(state = {}) {
  const computer = createShipComputer();
  computer.registerTerminal({ id: 'dilithium-matrix-console', systems: ['matrix', 'deflector'] });
  const snapshot = { phase: 'idle', matrix: { enabled: true, online: true, regulation: 1 } };
  const warpCoreSystem = {
    snapshot: () => snapshot,
    setMatrixEnabled: enabled => { snapshot.matrix.enabled = enabled; return snapshot; },
    setMatrixRegulation: regulation => { snapshot.matrix.regulation = regulation; return snapshot; }
  };
  registerShipComputerSystems(computer, {
    state: { warpCoreEnabled: true, warpCoreContainmentStable: true, warpCoreMatrixEnabled: true, ...state },
    getShip: () => ({ position: { x: 0, y: 0, z: 0 } }),
    getShipYaw: () => 0,
    getPitchAngle: () => 0,
    getAsteroids: () => [],
    warpCoreSystem
  });
  computer.boot();
  computer.connectTerminal('dilithium-matrix-console', 'TESTE');
  return { computer, snapshot };
}

test('Ship Computer bloqueia desligamento da matriz durante dobra', () => {
  const { computer } = setup({ warpDriveActive: true, warpTransition: 'cruise' });
  const result = computer.dispatch('dilithium-matrix-console', 'matrix', 'setEnabled', { enabled: false });
  assert.equal(result.ok, true);
  assert.equal(result.result.accepted, false);
  assert.equal(result.result.reason, 'warp-interlock-active');
});

test('Ship Computer controla a mesma instância da matriz e valida regulação', () => {
  const { computer, snapshot } = setup();
  const enabled = computer.dispatch('dilithium-matrix-console', 'matrix', 'setEnabled', { enabled: false });
  assert.equal(enabled.result.accepted, true);
  assert.equal(snapshot.matrix.enabled, false);
  const regulation = computer.dispatch('dilithium-matrix-console', 'matrix', 'setRegulation', { regulation: 0.65 });
  assert.equal(regulation.result.accepted, true);
  assert.equal(snapshot.matrix.regulation, 0.65);
  const invalid = computer.dispatch('dilithium-matrix-console', 'matrix', 'setRegulation', { regulation: 2 });
  assert.equal(invalid.result.accepted, false);
});
