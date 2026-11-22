import assert from 'node:assert/strict';
import test from 'node:test';
import { createShipComputer } from './shipComputer.js';
import { registerShipComputerSystems } from './shipComputerSystems.js';
import { createDilithiumMatrixTerminalController } from './dilithiumMatrixTerminalController.js';

function setup(state = {}) {
  const computer = createShipComputer();
  computer.registerTerminal({ id: 'dilithium-matrix-console', systems: ['matrix', 'deflector'] });
  computer.registerTerminal({ id: 'engineering-console', systems: ['matrix'] });
  computer.registerTerminal({ id: 'deflector-console', systems: ['deflector', 'navigation', 'sensors', 'power'] });
  const snapshot = { phase: 'idle', matrix: { enabled: true, online: true, regulation: 1 } };
  const warpCoreSystem = {
    snapshot: () => snapshot,
    setMatrixEnabled: enabled => { snapshot.matrix.enabled = enabled; return snapshot; },
    setMatrixRegulation: regulation => { snapshot.matrix.regulation = regulation; return snapshot; }
  };
  const deflectorSnapshot = { energy: 12, capacity: 100, powerBusConnected: true, emitter: { enabled: true, active: true }, sensors: { enabled: true, operational: true, contacts: [] }, navigation: { enabled: true, available: true }, protection: { enabled: false }, science: { enabled: true } };
  const deflectorRuntime = { snapshot: () => deflectorSnapshot, setEmitterEnabled: enabled => { deflectorSnapshot.emitter.enabled = enabled; return deflectorSnapshot; } };
  registerShipComputerSystems(computer, {
    state: { warpCoreEnabled: true, warpCoreContainmentStable: true, warpCoreMatrixEnabled: true, ...state },
    getShip: () => ({ position: { x: 0, y: 0, z: 0 } }),
    getShipYaw: () => 0,
    getPitchAngle: () => 0,
    getAsteroids: () => [],
    warpCoreSystem,
    deflectorRuntime
  });
  computer.boot();
  computer.connectTerminal('dilithium-matrix-console', 'TESTE');
  computer.connectTerminal('engineering-console', 'ENGENHEIRO');
  return { computer, snapshot, deflectorSnapshot };
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

test('controles da matriz permanecem restritos ao terminal dedicado', () => {
  const { computer } = setup();
  const result = computer.dispatch('engineering-console', 'matrix', 'setEnabled', { enabled: false });
  assert.equal(result.ok, true);
  assert.equal(result.result.accepted, false);
  assert.equal(result.result.reason, 'matrix-terminal-required');
});


test('console da matriz e console do defletor consultam a mesma telemetria autorizada', () => {
  const { computer, deflectorSnapshot } = setup();
  computer.connectTerminal('deflector-console', 'ENGENHEIRO');
  const deflectorStatus = computer.dispatch('deflector-console', 'deflector', 'status');
  computer.connectTerminal('dilithium-matrix-console', 'ENGENHEIRO DE ENERGIA');
  const matrixStatus = computer.dispatch('dilithium-matrix-console', 'deflector', 'status');
  assert.equal(deflectorStatus.result.available, true);
  assert.equal(matrixStatus.result.available, true);
  assert.equal(matrixStatus.result.core.energy, deflectorSnapshot.energy);
  assert.deepEqual(matrixStatus.result.emitter, deflectorSnapshot.emitter);
  const denied = computer.dispatch('dilithium-matrix-console', 'deflector', 'setEmitterEnabled', { enabled: false });
  assert.equal(denied.result.accepted, false);
  assert.equal(denied.result.reason, 'deflector-terminal-required');
});

test('fechar o terminal da matriz encerra a conexão e retorna à projeção passiva', () => {
  const computer = createShipComputer();
  computer.registerTerminal({ id: 'dilithium-matrix-console', systems: ['matrix'] });
  computer.boot();
  const renderer = {
    handlers: null,
    open: false,
    mount(handlers) { this.handlers = handlers; },
    setPresence() {},
    setOpen(value) { this.open = Boolean(value); },
    update() {},
    unmount() {}
  };
  const changes = [];
  const terminal = createDilithiumMatrixTerminalController({
    computer,
    renderer,
    onInteractionChange: active => changes.push(active)
  });
  terminal.initialize();
  terminal.setPresence(true, true);
  assert.equal(terminal.open('TESTE'), true);
  assert.equal(renderer.open, true);
  assert.equal(computer.isTerminalConnected('dilithium-matrix-console'), true);
  renderer.handlers.onClose();
  assert.equal(terminal.getSnapshot().open, false);
  assert.equal(renderer.open, false);
  assert.equal(computer.isTerminalConnected('dilithium-matrix-console'), false);
  assert.deepEqual(changes, [true, false]);
});
