import { SHIP_COMPUTER_MODULES } from '../modules/index.js';

export function createShipConsoleController({
  computer,
  renderer,
  terminalId = 'pilot-console',
  modules = SHIP_COMPUTER_MODULES
} = {}) {
  if (!computer || typeof computer.getSnapshot !== 'function' ||
      typeof computer.subscribe !== 'function' ||
      typeof computer.isTerminalConnected !== 'function' ||
      typeof computer.dispatch !== 'function') {
    throw new TypeError('O computador da nave não atende ao contrato do console.');
  }
  if (!renderer || typeof renderer.mount !== 'function' ||
      typeof renderer.render !== 'function' || typeof renderer.unmount !== 'function') {
    throw new TypeError('O renderizador do console está incompleto.');
  }

  let initialized = false;
  let opened = false;
  let unsubscribe = null;

  const render = snapshot => renderer.render({
    snapshot,
    open: opened,
    modules
  });

  function initialize() {
    if (initialized) return false;
    renderer.mount();
    unsubscribe = computer.subscribe(render);
    initialized = true;
    render(computer.getSnapshot());
    return true;
  }

  function open() {
    if (!initialized || !computer.isTerminalConnected(terminalId)) return false;
    if (opened) return true;
    opened = true;
    render(computer.getSnapshot());
    return true;
  }

  function close() {
    if (!initialized || !opened) return false;
    opened = false;
    render(computer.getSnapshot());
    return true;
  }

  function dispatch(systemId, command, payload) {
    if (!initialized || !opened) {
      return { ok: false, reason: 'console-closed' };
    }
    return computer.dispatch(terminalId, systemId, command, payload);
  }

  function shutdown() {
    if (!initialized) return false;
    opened = false;
    unsubscribe?.();
    unsubscribe = null;
    renderer.unmount();
    initialized = false;
    return true;
  }

  return Object.freeze({
    initialize,
    open,
    close,
    dispatch,
    shutdown,
    getSnapshot: () => ({
      initialized,
      open: opened,
      terminalId,
      modules: modules.map(module => module.id)
    })
  });
}

export function createShipConsoleRuntimeSystem(controller) {
  if (!controller || typeof controller.initialize !== 'function' ||
      typeof controller.shutdown !== 'function') {
    throw new TypeError('O controlador do console não pode ser integrado ao Runtime.');
  }

  return {
    priority: 35,
    initialize() {
      controller.initialize();
    },
    shutdown() {
      controller.shutdown();
    }
  };
}
