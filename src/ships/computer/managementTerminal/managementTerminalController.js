import { SHIP_COMPUTER_MODULES } from '../modules/index.js';

export const SHIP_MANAGEMENT_TERMINAL_ID = 'ship-management-terminal';

// Posição inicial de referência no convés da ponte; pode ser ajustada após validar o layout 3D.
export const SHIP_MANAGEMENT_TERMINAL_LOCAL_POSITION = Object.freeze({
  x: -6.5,
  y: 8.91,
  z: -29.5
});
export const SHIP_MANAGEMENT_TERMINAL_DISPLAY_RADIUS = 11;
export const SHIP_MANAGEMENT_TERMINAL_INTERACTION_RADIUS = 3.5;

export function createShipManagementTerminalController({
  computer,
  renderer,
  terminalId = SHIP_MANAGEMENT_TERMINAL_ID,
  modules = SHIP_COMPUTER_MODULES,
  onInteractionChange = () => {}
} = {}) {
  if (!computer || typeof computer.getSnapshot !== 'function' ||
      typeof computer.subscribe !== 'function' ||
      typeof computer.connectTerminal !== 'function' ||
      typeof computer.disconnectTerminal !== 'function' ||
      typeof computer.isTerminalConnected !== 'function' ||
      typeof computer.dispatch !== 'function') {
    throw new TypeError('O Ship Computer não atende ao contrato do terminal de gerenciamento.');
  }
  if (!renderer || typeof renderer.mount !== 'function' ||
      typeof renderer.render !== 'function' || typeof renderer.unmount !== 'function') {
    throw new TypeError('O renderizador do terminal de gerenciamento está incompleto.');
  }

  let initialized = false;
  let present = false;
  let opened = false;
  let unsubscribe = null;

  const render = snapshot => renderer.render({
    snapshot,
    present,
    open: opened,
    modules
  });

  function initialize() {
    if (initialized) return false;
    renderer.mount({
      onClose: close,
      onModuleSelect: moduleId => renderer.selectModule?.(moduleId)
    });
    unsubscribe = computer.subscribe(render);
    initialized = true;
    render(computer.getSnapshot());
    return true;
  }

  function setPresence(visible) {
    if (!initialized) return false;
    const next = Boolean(visible);
    if (present === next) return true;
    present = next;
    if (!present && opened) close();
    render(computer.getSnapshot());
    return true;
  }

  function open(operator = 'TRIPULANTE') {
    if (!initialized || !present) return false;
    if (opened) return true;
    if (!computer.connectTerminal(terminalId, operator)) return false;
    opened = true;
    onInteractionChange(true);
    render(computer.getSnapshot());
    return true;
  }

  function close() {
    if (!initialized || !opened) return false;
    opened = false;
    computer.disconnectTerminal(terminalId);
    onInteractionChange(false);
    render(computer.getSnapshot());
    return true;
  }

  function dispatch(systemId, command, payload) {
    if (!initialized || !opened || !computer.isTerminalConnected(terminalId)) {
      return { ok: false, reason: 'terminal-inactive' };
    }
    return computer.dispatch(terminalId, systemId, command, payload);
  }

  function shutdown() {
    if (!initialized) return false;
    if (opened) close();
    present = false;
    unsubscribe?.();
    unsubscribe = null;
    renderer.unmount();
    initialized = false;
    return true;
  }

  return Object.freeze({
    initialize,
    setPresence,
    open,
    close,
    dispatch,
    shutdown,
    getSnapshot: () => ({
      initialized,
      present,
      open: opened,
      terminalId,
      modules: modules.map(module => module.id)
    })
  });
}

export function createShipManagementTerminalRuntimeSystem(controller) {
  if (!controller || typeof controller.initialize !== 'function' ||
      typeof controller.shutdown !== 'function') {
    throw new TypeError('O terminal de gerenciamento não pode ser integrado ao Runtime.');
  }

  return {
    priority: 36,
    initialize() {
      controller.initialize();
    },
    shutdown() {
      controller.shutdown();
    }
  };
}
