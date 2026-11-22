import { SHIP_COMPUTER_MODULES } from '../modules/index.js';

export const SHIP_MANAGEMENT_TERMINAL_ID = 'ship-management-terminal';

// Emissor recuado para dentro dos limites da ponte, mantendo distância do posto de pilotagem.
// Coordenada sujeita à validação visual final no APK.
export const SHIP_MANAGEMENT_TERMINAL_LOCAL_POSITION = Object.freeze({
  x: -10.5,
  y: 8.91,
  z: -20
});
export const SHIP_MANAGEMENT_TERMINAL_DISPLAY_RADIUS = 11;
export const SHIP_MANAGEMENT_TERMINAL_INTERACTION_RADIUS = 3.5;

const MODULE_COMMANDS = Object.freeze({
  navigation: 'telemetry',
  tactical: 'scan',
  engineering: 'status',
  'warp-core': 'status'
});

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
    throw new TypeError('O renderizador do HUD de gerenciamento está incompleto.');
  }

  let initialized = false;
  let present = false;
  let interactionAvailable = false;
  let opened = false;
  let selectedModuleId = modules[0]?.id ?? 'navigation';
  let moduleData = null;
  let unsubscribe = null;

  const render = snapshot => renderer.render({
    snapshot,
    present,
    interactionAvailable,
    open: opened,
    modules,
    selectedModuleId,
    moduleData
  });

  function refreshSelectedModule() {
    const module = modules.find(item => item.id === selectedModuleId);
    if (!module) {
      moduleData = { available: false, label: 'MÓDULO DESCONHECIDO', message: 'Módulo não registrado.' };
      return moduleData;
    }
    if (!opened || !computer.isTerminalConnected(terminalId)) {
      moduleData = { available: false, label: module.label, phase: module.phase, message: module.scope };
      return moduleData;
    }
    if (module.id === 'onboard-ai') {
      const ai = computer.onboardAI;
      moduleData = ai ? { available: true, label: module.label, phase: module.phase, data: ai.snapshot(), permissions: computer.listAIPermissions() } : { available: false, label: module.label, phase: module.phase, message: 'IA de bordo indisponível.' };
      return moduleData;
    }
    if (!module.systemId || !MODULE_COMMANDS[module.id]) {
      moduleData = { available: false, label: module.label, phase: 'prepared', message: module.scope };
      return moduleData;
    }

    const response = computer.dispatch(
      terminalId,
      module.systemId,
      MODULE_COMMANDS[module.id] || 'status'
    );
    moduleData = response.ok
      ? { available: true, label: module.label, phase: module.phase, data: response.result }
      : { available: false, label: module.label, phase: module.phase, message: module.scope, reason: response.reason };
    return moduleData;
  }

  function selectModule(moduleId) {
    if (!modules.some(module => module.id === moduleId)) return false;
    selectedModuleId = moduleId;
    renderer.selectModule?.(moduleId);
    refreshSelectedModule();
    render(computer.getSnapshot());
    return true;
  }

  function initialize() {
    if (initialized) return false;
    renderer.mount({
      onOpen: () => open(),
      onClose: close,
      onModuleSelect: selectModule,
      onAIAction: action => {
        const ai = computer.onboardAI;
        if (!ai) return { ok: false, reason: 'ai-unavailable' };
        let result;
        if (action === 'patrol') result = ai.runPatrol();
        else if (action === 'diagnose') result = ai.diagnose();
        else if (action === 'voice') result = ai.startVoiceRecognition();
        else if (action === 'stop-voice') result = ai.stopVoiceRecognition();
        else return { ok: false, reason: 'unknown-ai-action' };
        refreshSelectedModule(); render(computer.getSnapshot()); return result;
      },
      onCommand: (systemId, command, payload) => {
        const response = dispatch(systemId, command, payload);
        if (response.ok) { refreshSelectedModule(); render(computer.getSnapshot()); }
        return response;
      }
    });
    unsubscribe = computer.subscribe(render);
    initialized = true;
    refreshSelectedModule();
    render(computer.getSnapshot());
    return true;
  }

  function setPresence(visible, canInteract = false) {
    if (!initialized) return false;
    const nextPresent = Boolean(visible);
    const nextAvailable = nextPresent && Boolean(canInteract);
    const changed = present !== nextPresent || interactionAvailable !== nextAvailable;
    present = nextPresent;
    interactionAvailable = nextAvailable;
    if (!present && opened) close();
    if (changed) render(computer.getSnapshot());
    return true;
  }

  function open(operator = 'TRIPULANTE') {
    if (!initialized || !present || !interactionAvailable) return false;
    if (opened) return true;
    if (!computer.connectTerminal(terminalId, operator)) return false;
    opened = true;
    refreshSelectedModule();
    onInteractionChange(true);
    render(computer.getSnapshot());
    return true;
  }

  function close() {
    if (!initialized || !opened) return false;
    opened = false;
    computer.disconnectTerminal(terminalId);
    moduleData = null;
    onInteractionChange(false);
    render(computer.getSnapshot());
    return true;
  }

  function refresh() {
    if (!initialized || !opened) return false;
    refreshSelectedModule();
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
    interactionAvailable = false;
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
    selectModule,
    refresh,
    shutdown,
    getSnapshot: () => ({
      initialized,
      present,
      interactionAvailable,
      open: opened,
      selectedModuleId,
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
