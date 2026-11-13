// Núcleo central do computador da nave — Star Frontier.
// Coordena acesso aos sistemas sem duplicar a lógica de cada ramificação.

export function createShipComputer({ shipId = 'aurora-7', displayName = 'COMPUTADOR DA NAVE' } = {}) {
  const systems = new Map();
  const terminals = new Map();
  const listeners = new Set();
  let online = false;
  let activeTerminalId = null;
  let revision = 0;

  const publish = () => {
    revision += 1;
    const snapshot = getSnapshot();
    for (const listener of listeners) listener(snapshot);
    return snapshot;
  };

  function getSnapshot() {
    return {
      shipId,
      displayName,
      online,
      activeTerminalId,
      revision,
      systems: [...systems.values()].map(system => ({
        id: system.id,
        name: system.name,
        status: system.getStatus ? system.getStatus() : 'standby'
      })),
      terminals: [...terminals.values()].map(terminal => ({
        id: terminal.id,
        name: terminal.name,
        connected: terminal.id === activeTerminalId
      }))
    };
  }

  function registerSystem(id, { name = id, commands = {}, getStatus = null } = {}) {
    if (!id || systems.has(id)) throw new Error('Sistema inválido ou já registrado.');
    systems.set(id, { id, name, commands: { ...commands }, getStatus });
    publish();
    return true;
  }

  function registerTerminal({ id, name = id, systems: allowedSystems = [] } = {}) {
    if (!id || terminals.has(id)) throw new Error('Terminal inválido ou já registrado.');
    terminals.set(id, { id, name, systems: new Set(allowedSystems) });
    publish();
    return true;
  }

  function boot() {
    online = true;
    publish();
    return getSnapshot();
  }

  function shutdown() {
    activeTerminalId = null;
    online = false;
    publish();
    return getSnapshot();
  }

  function connectTerminal(id, operator = 'PILOTO') {
    const terminal = terminals.get(id);
    if (!online || !terminal || (activeTerminalId && activeTerminalId !== id)) return false;
    activeTerminalId = id;
    terminal.operator = String(operator || 'PILOTO').slice(0, 32);
    publish();
    return true;
  }

  function disconnectTerminal(id) {
    if (activeTerminalId !== id) return false;
    activeTerminalId = null;
    publish();
    return true;
  }

  function isTerminalConnected(id) {
    return online && activeTerminalId === id;
  }

  function dispatch(terminalId, systemId, command, payload) {
    if (!isTerminalConnected(terminalId)) return { ok: false, reason: 'terminal-disconnected' };
    const terminal = terminals.get(terminalId);
    if (!terminal?.systems.has(systemId)) return { ok: false, reason: 'access-denied' };
    const system = systems.get(systemId);
    const handler = system?.commands?.[command];
    if (typeof handler !== 'function') return { ok: false, reason: 'command-unavailable' };
    try {
      return { ok: true, result: handler(payload, { shipId, terminalId, operator: terminal.operator }) };
    } catch (error) {
      return { ok: false, reason: 'command-failed', error };
    }
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('Listener inválido.');
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return Object.freeze({
    boot,
    shutdown,
    registerSystem,
    registerTerminal,
    connectTerminal,
    disconnectTerminal,
    isTerminalConnected,
    dispatch,
    getSnapshot,
    subscribe
  });
}
