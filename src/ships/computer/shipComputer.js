import { createShipComputerAI } from './shipComputerAI.js';

// Núcleo central do computador da nave — Star Frontier.
// Coordena sistemas, terminais e permissões sem duplicar a lógica das ramificações.
export function createShipComputer({
  shipId = 'aurora-7',
  displayName = 'COMPUTADOR DA NAVE',
  aiDatabaseAdapter = null
} = {}) {
  const systems = new Map();
  const terminals = new Map();
  const listeners = new Set();
  const aiPermissions = new Map();
  let online = false;
  let activeTerminalId = null;
  const connectedTerminalIds = new Set();
  let revision = 0;
  let onboardAI = null;

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
        connected: connectedTerminalIds.has(terminal.id)
      })),
      onboardAI: onboardAI?.snapshot?.() ?? { status: 'offline' }
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
    onboardAI?.stopVoiceRecognition?.();
    activeTerminalId = null;
    connectedTerminalIds.clear();
    aiPermissions.clear();
    online = false;
    publish();
    return getSnapshot();
  }

  function connectTerminal(id, operator = 'PILOTO') {
    const terminal = terminals.get(id);
    if (!online || !terminal) return false;
    connectedTerminalIds.add(id);
    activeTerminalId = id;
    terminal.operator = String(operator || 'PILOTO').slice(0, 32);
    publish();
    return true;
  }

  function disconnectTerminal(id) {
    if (!connectedTerminalIds.has(id)) return false;
    connectedTerminalIds.delete(id);
    activeTerminalId = [...connectedTerminalIds].at(-1) ?? null;
    publish();
    return true;
  }

  function isTerminalConnected(id) {
    return online && connectedTerminalIds.has(id);
  }

  function dispatch(terminalId, systemId, command, payload) {
    if (!isTerminalConnected(terminalId)) return { ok: false, reason: 'terminal-disconnected' };
    const terminal = terminals.get(terminalId);
    if (!terminal?.systems.has(systemId)) return { ok: false, reason: 'access-denied' };
    const system = systems.get(systemId);
    const handler = system?.commands?.[command];
    if (typeof handler !== 'function') return { ok: false, reason: 'command-unavailable' };
    try {
      return { ok: true, result: handler(payload, { shipId, terminalId, operator: terminal.operator, authority: 'terminal' }) };
    } catch (error) {
      return { ok: false, reason: 'command-failed', error };
    }
  }

  // Somente o Ship Computer concede ou revoga permissões da IA.
  function grantAIPermission({ terminalId, systemId, commands = [] } = {}) {
    const terminal = terminals.get(terminalId);
    const system = systems.get(systemId);
    if (!online || !terminal || !system || !terminal.systems.has(systemId)) {
      return { granted: false, reason: 'terminal-system-link-unavailable' };
    }
    const registeredCommands = commands.filter(command =>\n      !/^(create|add|register|build|construct|spawn)/i.test(String(command)) &&\n      typeof system.commands?.[command] === 'function'\n    );
    if (registeredCommands.length === 0) return { granted: false, reason: 'no-registered-commands' };
    let systemsForTerminal = aiPermissions.get(terminalId);
    if (!systemsForTerminal) {
      systemsForTerminal = new Map();
      aiPermissions.set(terminalId, systemsForTerminal);
    }
    systemsForTerminal.set(systemId, new Set(registeredCommands));
    publish();
    return { granted: true, terminalId, systemId, commands: registeredCommands };
  }

  function revokeAIPermission({ terminalId, systemId } = {}) {
    const systemsForTerminal = aiPermissions.get(terminalId);
    if (!systemsForTerminal) return false;
    const revoked = systemId ? systemsForTerminal.delete(systemId) : (aiPermissions.delete(terminalId), true);
    if (systemsForTerminal.size === 0) aiPermissions.delete(terminalId);
    if (revoked) publish();
    return Boolean(revoked);
  }

  function listAIPermissions() {
    return [...aiPermissions.entries()].flatMap(([terminalId, systemsForTerminal]) =>
      [...systemsForTerminal.entries()].map(([systemId, commands]) => ({
        terminalId, systemId, commands: [...commands]
      }))
    );
  }

  function dispatchAuthorizedAI({ terminalId, systemId, command, payload = {}, authority } = {}) {
    if (!online) return { ok: false, reason: 'ship-computer-offline' };
    const terminal = terminals.get(terminalId);
    const system = systems.get(systemId);
    const allowedCommands = aiPermissions.get(terminalId)?.get(systemId);
    if (!terminal || !system || !allowedCommands?.has(command)) {
      return { ok: false, reason: 'ai-permission-denied' };
    }
    const handler = system.commands?.[command];
    if (typeof handler !== 'function') return { ok: false, reason: 'command-unavailable' };
    try {
      const result = handler(payload, {
        shipId,
        terminalId,
        operator: 'AURORA-IA',
        authority: authority || 'onboard-ai'
      });
      return { ok: true, result };
    } catch (error) {
      return { ok: false, reason: 'command-failed', error };
    }
  }

  function inspectSystem(id) {
    const system = systems.get(id);
    if (!system) return { status: 'unknown', reason: 'system-not-registered' };
    let status = 'standby';
    try { status = system.getStatus ? system.getStatus() : 'registered'; }
    catch (error) { return { status: 'error', error: String(error?.message || error) }; }
    return { status, name: system.name };
  }

  onboardAI = createShipComputerAI({
    shipId,
    getSnapshot,
    getSystemIds: () => [...systems.keys()],
    inspectSystem,
    dispatchAuthorized: dispatchAuthorizedAI,
    isOnline: () => online,
    databaseAdapter: aiDatabaseAdapter,
    onChange: publish
  });

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
    grantAIPermission,
    revokeAIPermission,
    listAIPermissions,
    onboardAI,
    getSnapshot,
    subscribe
  });
}
