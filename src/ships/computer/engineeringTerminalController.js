export const ENGINEERING_CONSOLE_ID = 'engineering-console';
export const ENGINEERING_CONSOLE_LOCAL_POSITION = Object.freeze({ x: 8.1, y: -2.72, z: -2 });
export const ENGINEERING_CONSOLE_DISPLAY_RADIUS = 8;
export const ENGINEERING_CONSOLE_INTERACTION_RADIUS = 3.6;

export function createEngineeringTerminalController({ computer, terminalId = ENGINEERING_CONSOLE_ID, onInteractionChange = () => {} } = {}) {
  if (!computer || typeof computer.connectTerminal !== 'function' ||
      typeof computer.disconnectTerminal !== 'function' ||
      typeof computer.isTerminalConnected !== 'function' || typeof computer.dispatch !== 'function') {
    throw new TypeError('O console de Engenharia precisa de uma conexão válida com o Ship Computer.');
  }
  let initialized = false, present = false, interactionAvailable = false, connected = false;
  function initialize() {
    if (initialized) return false;
    initialized = true;
    return true;
  }
  function open(operator = 'ENGENHEIRO') {
    if (!initialized || !present || !interactionAvailable || connected) return false;
    if (!computer.connectTerminal(terminalId, operator)) return false;
    connected = true;
    onInteractionChange(true);
    return true;
  }
  function close() {
    if (!connected) return false;
    connected = false;
    computer.disconnectTerminal(terminalId);
    onInteractionChange(false);
    return true;
  }
  function setPresence(visible, canInteract = false) {
    if (!initialized) return false;
    present = Boolean(visible);
    interactionAvailable = present && Boolean(canInteract);
    if (!present || !interactionAvailable) close();
    return true;
  }
  function dispatch(systemId, command, payload) {
    if (!initialized || !connected || !computer.isTerminalConnected(terminalId)) {
      return { ok: false, reason: 'engineering-terminal-inactive' };
    }
    return computer.dispatch(terminalId, systemId, command, payload);
  }
  function shutdown() {
    if (!initialized) return false;
    close();
    present = false;
    interactionAvailable = false;
    initialized = false;
    return true;
  }
  return Object.freeze({
    initialize, open, close, setPresence, dispatch, shutdown,
    getSnapshot: () => ({ initialized, present, interactionAvailable, connected, terminalId })
  });
}

export function createEngineeringTerminalRuntimeSystem(controller) {
  if (!controller || typeof controller.initialize !== 'function' || typeof controller.shutdown !== 'function') {
    throw new TypeError('O console de Engenharia não pode ser integrado ao Runtime.');
  }
  return { priority: 37, initialize() { controller.initialize(); }, shutdown() { controller.shutdown(); } };
}
