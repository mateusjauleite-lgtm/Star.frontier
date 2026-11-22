export const DEFLECTOR_TERMINAL_ID = 'deflector-console';
export const DEFLECTOR_TERMINAL_LOCAL_POSITION = Object.freeze({ x: 4.3, y: -2.72, z: -43.0 });
export const DEFLECTOR_TERMINAL_DISPLAY_RADIUS = 7;
export const DEFLECTOR_TERMINAL_INTERACTION_RADIUS = 3.5;

export function createDeflectorTerminalController({ computer, terminalId = DEFLECTOR_TERMINAL_ID, onInteractionChange = () => {} } = {}) {
  if (!computer || typeof computer.connectTerminal !== 'function' || typeof computer.disconnectTerminal !== 'function' || typeof computer.isTerminalConnected !== 'function' || typeof computer.dispatch !== 'function') throw new TypeError('O console do defletor precisa de uma conexão válida com o Ship Computer.');
  let initialized = false, present = false, interactionAvailable = false, connected = false;
  function initialize() { if (initialized) return false; initialized = true; return true; }
  function open(operator = 'OPERADOR DO DEFLETOR') { if (!initialized || !present || !interactionAvailable || connected) return false; if (!computer.connectTerminal(terminalId, operator)) return false; connected = true; onInteractionChange(true); return true; }
  function close() { if (!connected) return false; connected = false; computer.disconnectTerminal(terminalId); onInteractionChange(false); return true; }
  function setPresence(visible, canInteract = false) { if (!initialized) return false; present = Boolean(visible); interactionAvailable = present && Boolean(canInteract); if (!present || !interactionAvailable) close(); return true; }
  function dispatch(systemId, command, payload) { if (!initialized || !connected || !computer.isTerminalConnected(terminalId)) return { ok: false, reason: 'deflector-terminal-inactive' }; return computer.dispatch(terminalId, systemId, command, payload); }
  function shutdown() { if (!initialized) return false; close(); present = false; interactionAvailable = false; initialized = false; return true; }
  return Object.freeze({ initialize, open, close, setPresence, dispatch, shutdown, getSnapshot: () => ({ initialized, present, interactionAvailable, connected, terminalId }) });
}
export function createDeflectorTerminalRuntimeSystem(controller) { if (!controller || typeof controller.initialize !== 'function' || typeof controller.shutdown !== 'function') throw new TypeError('O console do defletor não pode ser integrado ao Runtime.'); return { priority: 38, initialize() { controller.initialize(); }, shutdown() { controller.shutdown(); } }; }
