import template from './management-terminal.html?raw';
import './management-terminal.css';

const MODULE_LABELS = Object.freeze({
  navigation: 'Navegação',
  tactical: 'Sensores e tático',
  weapons: 'Arsenal',
  engineering: 'Energia do núcleo',
  'warp-core': 'Núcleo de dobra',
  defense: 'Defesa',
  diagnostics: 'Diagnósticos',
  'onboard-ai': 'ALEXIA · IA de bordo'
});

function humanizeKey(value) {
  return String(value).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toUpperCase();
}

function formatValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'ATIVO' : 'INATIVO';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (Array.isArray(value)) return value.length ? value.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item)).join(' · ') : 'NENHUM';
  if (typeof value === 'object') return Object.keys(value).length ? Object.entries(value).map(([key, item]) => `${humanizeKey(key)}: ${formatValue(item)}`).join(' | ') : 'SEM DADOS';
  return String(value);
}

function collectTelemetry(value, prefix = '', rows = []) {
  if (rows.length >= 8) return rows;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (rows.length >= 8) break;
      const label = prefix ? `${prefix} / ${humanizeKey(key)}` : humanizeKey(key);
      if (item && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).length) collectTelemetry(item, label, rows);
      else rows.push([label, formatValue(item)]);
    }
  } else if (value !== undefined) rows.push([prefix || 'VALOR', formatValue(value)]);
  return rows;
}

export function createShipManagementTerminalRenderer({ root, html = template } = {}) {
  if (!root || typeof root.append !== 'function') throw new TypeError('O elemento raiz do HUD de gerenciamento não foi encontrado.');
  let layer = null;
  let selectedModule = 'navigation';
  let openHandler = null;
  let closeHandler = null;
  let selectHandler = null;
  let commandHandler = null;
  let aiActionHandler = null;

  function mount({ onOpen = () => {}, onClose = () => {}, onModuleSelect = () => {}, onCommand = () => ({ ok: false }), onAIAction = () => ({ ok: false }) } = {}) {
    if (layer) return false;
    const wrapper = document.createElement('div');
    wrapper.className = 'ship-management-hud-layer';
    wrapper.innerHTML = html.trim();
    if (!wrapper.firstElementChild) throw new Error('O template do HUD de gerenciamento está vazio.');
    layer = wrapper;
    openHandler = onOpen;
    closeHandler = onClose;
    selectHandler = onModuleSelect;
    commandHandler = onCommand;
    aiActionHandler = onAIAction;
    layer.addEventListener('click', event => {
      if (event.target.closest('[data-management-open]')) { openHandler?.(); return; }
      if (event.target.closest('[data-management-close]')) { closeHandler?.(); return; }
      const aiAction = event.target.closest('[data-ai-action]');
      if (aiAction) {
        const feedback = layer.querySelector('[data-ai-feedback]');
        const result = aiActionHandler?.(aiAction.dataset.aiAction);
        if (feedback) feedback.textContent = result?.ok ? 'SOLICITAÇÃO PROCESSADA · ' + (result.report ? result.report.systemsChecked + ' SISTEMAS VERIFICADOS' : 'COMANDO ENCAMINHADO') : 'AÇÃO NÃO DISPONÍVEL · ' + (result?.reason || 'ERRO');
        return;
      }
      if (event.target.closest('[data-shield-toggle]')) {
        const enabled = event.target.closest('[data-shield-toggle]').dataset.enabled === 'true';
        const response = commandHandler?.('shields', 'setEnabled', { enabled: !enabled });
        const feedback = layer.querySelector('[data-shield-feedback]');
        if (feedback) feedback.textContent = response?.ok && response.result?.accepted ? (!enabled ? 'ESCUDOS ATIVADOS' : 'ESCUDOS DESATIVADOS') : 'COMANDO NÃO AUTORIZADO';
        return;
      }
      if (event.target.closest('[data-power-transfer]')) {
        const input = layer.querySelector('[data-power-transfer-amount]');
        const response = commandHandler?.('power', 'transferRefinedDilithium', { amount: Number(input?.value) });
        const result = response?.result;
        const feedback = layer.querySelector('[data-power-transfer-feedback]');
        if (feedback) {
          if (response?.ok && result?.accepted) {
            feedback.textContent = 'TRANSFERÊNCIA CONCLUÍDA · ' + Number(result.transferred).toFixed(2) + ' u';
            if (input) input.value = '';
          } else {
            const reason = result?.reason || response?.reason || 'transfer-failed';
            const messages = {
              'invalid-amount': 'Informe uma quantidade válida.',
              'insufficient-refined-stock': 'Estoque refinado insuficiente.',
              'core-capacity-exceeded': 'Espaço insuficiente no reservatório de dobra.',
              'management-terminal-required': 'Comando não autorizado neste terminal.',
              'refinery-transfer-unavailable': 'Sistema da Refinaria indisponível.',
              'ship-unavailable': 'Nave indisponível.'
            };
            feedback.textContent = messages[reason] || 'TRANSFERÊNCIA RECUSADA · ' + reason;
          }
        }
        return;
      }
      const button = event.target.closest('[data-management-module]');
      if (!button) return;
      selectedModule = button.dataset.managementModule;
      selectHandler?.(selectedModule);
      updateSelection();
    });
    root.append(layer);
    return true;
  }

  function updateSelection() {
    if (!layer) return;
    layer.querySelectorAll('[data-management-module]').forEach(button => {
      const selected = button.dataset.managementModule === selectedModule;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function selectModule(moduleId) { selectedModule = moduleId; updateSelection(); }

  function renderTelemetry(moduleData, selectedModuleId) {
    const output = layer.querySelector('[data-management-detail-output]');
    if (!output) return;
    output.replaceChildren();
    if (!moduleData?.available || !moduleData.data) {
      const empty = document.createElement('div');
      empty.className = 'management-telemetry-empty';
      empty.textContent = moduleData?.message || 'Este aplicativo está preparado para integração. A telemetria operacional será conectada em uma próxima etapa.';
      output.append(empty);
      return;
    }
    const rows = collectTelemetry(moduleData.data);
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'management-telemetry-empty';
      empty.textContent = 'Sistema conectado. Aguardando dados de telemetria.';
      output.append(empty);
      return;
    }
    if (selectedModuleId === 'onboard-ai') {
      const actions = document.createElement('section'); actions.className = 'management-telemetry-card';
      const title = document.createElement('b'); title.textContent = 'CONTROLE DA ALEXIA';
      const description = document.createElement('small'); description.textContent = 'A IA opera somente por permissões concedidas pelo Ship Computer.';
      const controls = document.createElement('div'); controls.className = 'management-ai-controls';
      for (const [action, label] of [['voice','CHAMAR POR VOZ'],['patrol','INICIAR RONDA'],['diagnose','DIAGNÓSTICO GERAL'],['stop-voice','ENCERRAR ESCUTA']]) { const button = document.createElement('button'); button.type = 'button'; button.dataset.aiAction = action; button.textContent = label; controls.append(button); }
      const feedback = document.createElement('small'); feedback.dataset.aiFeedback = 'true'; feedback.textContent = 'Aguardando comando do operador.';
      actions.append(title, description, controls, feedback); output.append(actions);
    }
    for (const [label, value] of rows) {
      const card = document.createElement('article');
      card.className = 'management-telemetry-card';
      const caption = document.createElement('small');
      caption.textContent = label;
      const reading = document.createElement('b');
      reading.textContent = value;
      card.append(caption, reading);
      output.append(card);
    }
    if (selectedModuleId === 'defense') {
      const shield = moduleData.data;
      const action = document.createElement('section'); action.className = 'management-telemetry-card management-shield-control';
      const title = document.createElement('b'); title.textContent = 'CONTROLE DOS ESCUDOS';
      const button = document.createElement('button'); button.type = 'button'; button.dataset.shieldToggle = 'true'; button.dataset.enabled = String(Boolean(shield.enabled)); button.textContent = shield.enabled ? 'DESLIGAR ESCUDOS' : 'LIGAR ESCUDOS'; button.disabled = !moduleData.available;
      const feedback = document.createElement('small'); feedback.dataset.shieldFeedback = 'true'; feedback.textContent = shield.enabled ? 'Escudos ativos · consumo de EPS em andamento' : 'Escudos desligados · sem consumo de EPS';
      action.append(title, button, feedback); output.append(action);
    }
  }

  function render({ snapshot, present, interactionAvailable, open, modules = [], selectedModuleId, moduleData } = {}) {
    if (!layer) return;
    layer.hidden = !present && !open;
    layer.dataset.mode = open ? 'interactive' : 'passive';
    layer.setAttribute('aria-hidden', String(!present && !open));
    const openButton = layer.querySelector('[data-management-open]');
    if (openButton) { openButton.hidden = !interactionAvailable || open; openButton.disabled = !interactionAvailable || open; }
    const interaction = layer.querySelector('[data-management-interaction]');
    if (interaction) interaction.hidden = !open;
    const online = Boolean(snapshot?.online);
    layer.querySelectorAll('[data-management-status]').forEach(status => {
      status.textContent = online ? 'ONLINE' : 'EM ESPERA';
      status.dataset.state = online ? 'online' : 'standby';
    });
    const systemStates = new Map((snapshot?.systems ?? []).map(system => [system.id, system.status]));
    layer.querySelectorAll('[data-management-module]').forEach(button => {
      const systemId = button.dataset.systemId;
      const state = systemId ? systemStates.get(systemId) : null;
      const stateLabel = button.querySelector('[data-module-state]');
      if (stateLabel) stateLabel.textContent = state ? String(state).toUpperCase() : 'PREPARADO';
    });
    const connection = layer.querySelector('[data-management-connection]');
    if (connection) connection.textContent = online ? 'LINK CENTRAL ESTABELECIDO' : 'AGUARDANDO CONEXÃO CENTRAL';
    const moduleCount = layer.querySelector('[data-management-module-count]');
    if (moduleCount) moduleCount.textContent = String(modules.length).padStart(2, '0');
    const centralState = layer.querySelector('[data-management-central-state]');
    if (centralState) centralState.textContent = online ? 'ONLINE' : 'EM ESPERA';
    const systemList = layer.querySelector('[data-management-system-list]');
    if (systemList) {
      systemList.replaceChildren();
      const systems = snapshot?.systems ?? [];
      for (const system of systems) {
        const row = document.createElement('div');
        row.className = 'management-system-row';
        const name = document.createElement('span');
        name.textContent = humanizeKey(system.id);
        const status = document.createElement('small');
        status.textContent = String(system.status ?? 'STANDBY').toUpperCase();
        status.dataset.state = String(system.status ?? '').toLowerCase() === 'online' ? 'online' : 'standby';
        row.append(name, status);
        systemList.append(row);
      }
      if (!systems.length) {
        const empty = document.createElement('span');
        empty.textContent = 'Nenhum subsistema reportado.';
        systemList.append(empty);
      }
    }
    const module = modules.find(item => item.id === (selectedModuleId || selectedModule));
    const title = module?.label || MODULE_LABELS[selectedModule] || 'Sistema da nave';
    const titleNode = layer.querySelector('[data-management-detail-title]');
    const headingNode = layer.querySelector('[data-management-detail-heading]');
    const description = layer.querySelector('[data-management-detail-description]');
    if (titleNode) titleNode.textContent = title.toUpperCase();
    if (headingNode) headingNode.textContent = title;
    if (description) description.textContent = moduleData?.available
      ? 'Telemetria atual recebida do sistema de bordo.'
      : moduleData?.message || module?.scope || 'Aplicativo preparado para integração com o computador central.';
    const detailState = layer.querySelector('[data-management-detail-state]');
    if (detailState) {
      detailState.textContent = moduleData?.available ? 'SISTEMA CONECTADO' : 'MÓDULO PREPARADO';
      detailState.dataset.state = moduleData?.available ? 'online' : 'standby';
    }
    renderTelemetry(moduleData, selectedModuleId);
    const transferPanel = layer.querySelector('[data-power-transfer-panel]');
    if (transferPanel) {
      const powerSelected = (selectedModuleId || selectedModule) === 'warp-core';
      transferPanel.hidden = !powerSelected;
      const refinery = moduleData?.data?.refinery;
      const buffer = Math.max(0, Number(refinery?.refinedBuffer) || 0);
      const free = Math.max(0, Number(refinery?.coreRemainingCapacity) || 0);
      const transferable = Math.min(buffer, free);
      const core = moduleData?.data?.warpCore || {};
      const rawOre = Math.max(0, Number(refinery?.rawOre) || 0);
      const bufferNode = layer.querySelector('[data-power-transfer-buffer]');
      const coreNode = layer.querySelector('[data-power-transfer-core]');
      const capacityNode = layer.querySelector('[data-power-transfer-capacity]');
      const rawNode = layer.querySelector('[data-warp-core-raw]');
      const personalRawNode = layer.querySelector('[data-warp-core-personal-raw]');
      const consumptionNode = layer.querySelector('[data-warp-core-consumption]');
      const stageNode = layer.querySelector('[data-warp-core-stage]');
      const consumedNode = layer.querySelector('[data-warp-core-consumed-total]');
      const processingNode = layer.querySelector('[data-warp-core-processing]');
      const refiningRateNode = layer.querySelector('[data-warp-core-refining-rate]');
      const autoTransferNode = layer.querySelector('[data-warp-core-auto-transfer]');
      const transferRateNode = layer.querySelector('[data-warp-core-transfer-rate]');
      const plasmaNode = layer.querySelector('[data-warp-core-plasma]');
      const plasmaRateNode = layer.querySelector('[data-warp-core-plasma-rate]');
      const throttleNode = layer.querySelector('[data-warp-core-throttle]');
      const input = layer.querySelector('[data-power-transfer-amount]');
      const button = layer.querySelector('[data-power-transfer]');
      if (bufferNode) bufferNode.textContent = buffer.toFixed(2) + ' u';
      if (coreNode) coreNode.textContent = (Number(refinery?.coreDilithium) || 0).toFixed(2) + ' u';
      if (capacityNode) capacityNode.textContent = free.toFixed(2) + ' u';
      if (rawNode) rawNode.textContent = rawOre.toFixed(2) + ' u';
      if (personalRawNode) personalRawNode.textContent = (Number(moduleData?.data?.personalRawDilithiumOre) || 0).toFixed(2) + ' u';
      if (consumptionNode) consumptionNode.textContent = (Number(core.consumptionRate) || 0).toFixed(3) + ' u/s';
      if (stageNode) stageNode.textContent = core.active ? `DOBRA ${Number(core.stage) || 0} · ATIVA` : 'DESATIVADA';
      if (consumedNode) consumedNode.textContent = (Number(core.consumedTotal) || 0).toFixed(2) + ' u';
      if (processingNode) processingNode.textContent = refinery?.refineryEnabled ? 'ATIVO' : 'DESLIGADO';
      if (refiningRateNode) refiningRateNode.textContent = (Number(refinery?.refiningRate) || 0).toFixed(3) + ' u/s';
      if (autoTransferNode) autoTransferNode.textContent = refinery?.transferEnabled ? 'ATIVA' : 'DESLIGADA';
      if (transferRateNode) transferRateNode.textContent = (Number(refinery?.transferRate) || 0).toFixed(3) + ' u/s';
      if (plasmaNode) plasmaNode.textContent = (Number(moduleData?.data?.plasma?.amount) || 0).toFixed(2) + ' u';
      if (plasmaRateNode) plasmaRateNode.textContent = (Number(moduleData?.data?.plasma?.consumptionRate) || 0).toFixed(3) + ' u/s';
      if (throttleNode) throttleNode.textContent = core.conventionalThrottleActive ? 'ATIVO' : 'DESLIGADO';
      if (input) input.max = transferable.toFixed(2);
      if (button) button.disabled = !moduleData?.available || !refinery?.available || transferable <= 0;
    }
    updateSelection();
  }

  function unmount() {
    layer?.remove();
    layer = null;
    openHandler = null;
    closeHandler = null;
    selectHandler = null;
    commandHandler = null;
  }
  return Object.freeze({ mount, render, selectModule, unmount });
}
