export const DILITHIUM_MATRIX_TERMINAL_ID = 'dilithium-matrix-console';
export const DILITHIUM_MATRIX_DISPLAY_RADIUS = 8;
export const DILITHIUM_MATRIX_INTERACTION_RADIUS = 3.2;

export function createDilithiumMatrixTerminalController({ computer, renderer, terminalId = DILITHIUM_MATRIX_TERMINAL_ID, onInteractionChange = () => {} } = {}) {
  if (!computer || !['connectTerminal', 'disconnectTerminal', 'isTerminalConnected', 'dispatch'].every(k => typeof computer[k] === 'function')) {
    throw new TypeError('Ship Computer indisponível para a matriz.');
  }
  if (!renderer || !['mount', 'setPresence', 'setOpen', 'update', 'unmount'].every(k => typeof renderer[k] === 'function')) {
    throw new TypeError('Interface do terminal da matriz incompleta.');
  }
  let initialized = false, present = false, available = false, opened = false;
  function dispatch(systemId, command, payload) {
    if (!initialized || !opened || !computer.isTerminalConnected(terminalId)) return { ok: false, reason: 'matrix-terminal-inactive' };
    return computer.dispatch(terminalId, systemId, command, payload);
  }
  function refresh() {
    if (!opened) return false;
    const response = dispatch('matrix', 'status');
    if (!response.ok) return false;
    const deflector = dispatch('deflector', 'status');
    renderer.update({ ...response.result, deflector: deflector.ok ? deflector.result : null });
    return true;
  }
  function initialize() {
    if (initialized) return false;
    renderer.mount({
      onOpen: () => open(),
      onClose: close,
      onCommand: (systemId, command, payload) => {
        const result = dispatch(systemId, command, payload);
        refresh();
        return result;
      }
    });
    initialized = true;
    renderer.setPresence(present);
    return true;
  }
  function setPresence(value, canInteract = false) {
    if (!initialized) return false;
    present = Boolean(value);
    available = present && Boolean(canInteract);
    renderer.setPresence(present && available);
    if ((!present || !available) && opened) close();
    return true;
  }
  function open(operator = 'ENGENHEIRO DE ENERGIA') {
    if (!initialized || !present || !available) return false;
    if (opened) return true;
    if (!computer.connectTerminal(terminalId, operator)) return false;
    opened = true;
    renderer.setOpen(true);
    refresh();
    onInteractionChange(true);
    return true;
  }
  function close() {
    if (!opened) return false;
    opened = false;
    renderer.setOpen(false);
    computer.disconnectTerminal(terminalId);
    onInteractionChange(false);
    return true;
  }
  function shutdown() {
    if (!initialized) return false;
    close();
    present = false;
    available = false;
    renderer.setPresence(false);
    renderer.unmount();
    initialized = false;
    return true;
  }
  return Object.freeze({ initialize, setPresence, open, close, dispatch, refresh, shutdown,
    getSnapshot: () => ({ initialized, present, interactionAvailable: available, open: opened, terminalId }) });
}

export function createDilithiumMatrixTerminalRuntimeSystem(controller) {
  if (!controller || typeof controller.initialize !== 'function' || typeof controller.shutdown !== 'function') {
    throw new TypeError('Terminal da matriz inválido.');
  }
  return { priority: 38, initialize() { controller.initialize(); }, shutdown() { controller.shutdown(); } };
}
