import template from './management-terminal.html?raw';
import './management-terminal.css';

const MODULE_LABELS = Object.freeze({
  navigation: 'Navegação',
  tactical: 'Sensores e tático',
  weapons: 'Arsenal',
  engineering: 'Energia do núcleo',
  defense: 'Defesa',
  diagnostics: 'Diagnósticos'
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
  let powerCommandHandler = null;

  function mount({ onOpen = () => {}, onClose = () => {}, onModuleSelect = () => {}, onPowerCommand = () => {} } = {}) {
    if (layer) return false;
    const wrapper = document.createElement('div');
    wrapper.className = 'ship-management-hud-layer';
    wrapper.innerHTML = html.trim();
    if (!wrapper.firstElementChild) throw new Error('O template do HUD de gerenciamento está vazio.');
    layer = wrapper;
    openHandler = onOpen;
    closeHandler = onClose;
    selectHandler = onModuleSelect;
    powerCommandHandler = onPowerCommand;
    layer.addEventListener('click', event => {
      if (event.target.closest('[data-management-open]')) { openHandler?.(); return; }
      if (event.target.closest('[data-management-close]')) { closeHandler?.(); return; }
      const refinery = event.target.closest('[data-management-refinery-toggle]');
      if (refinery) {
        const enabled = refinery.dataset.enabled !== 'true';
        powerCommandHandler?.('setRefineryEnabled', { enabled });
        return;
      }
      const transfer = event.target.closest('[data-management-transfer-toggle]');
      if (transfer) {
        const enabled = transfer.dataset.enabled !== 'true';
        powerCommandHandler?.('setTransferEnabled', { enabled });
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

  function renderTelemetry(moduleData) {
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
  }

  function renderPowerControls(moduleData, selectedModuleId, open) {
    const controls = layer.querySelector('[data-management-power-controls]');
    if (!controls) return;
    const visible = selectedModuleId === 'engineering' && Boolean(moduleData?.available) && Boolean(open);
    controls.hidden = !visible;
    if (!visible) return;
    const refinery = moduleData.data?.refinery || {};
    const units = value => (Number(value) || 0).toFixed(2) + ' u';
    const set = (selector, value) => {
      const node = layer.querySelector(selector);
      if (node) node.textContent = value;
    };
    set('[data-management-core-amount]', units(refinery.coreDilithium ?? moduleData.data.refinedDilithium));
    set('[data-management-raw-amount]', units(refinery.rawOre));
    set('[data-management-buffer-amount]', units(refinery.refinedBuffer));
    set('[data-management-consumed-amount]', units(refinery.consumedTotal));
    set('[data-management-transfer-rate]', units(refinery.transferRate) + '/s');
    set('[data-management-support]', Array.isArray(refinery.supportSystems) && refinery.supportSystems.length ? refinery.supportSystems.join(', ').toUpperCase() : 'SEM RESERVA');
    layer.querySelector('[data-management-core-link]')?.classList.toggle('is-active', Boolean(refinery.transferEnabled));
    const refineryButton = layer.querySelector('[data-management-refinery-toggle]');
    const transferButton = layer.querySelector('[data-management-transfer-toggle]');
    if (refineryButton) {
      refineryButton.dataset.enabled = String(Boolean(refinery.refineryEnabled));
      refineryButton.textContent = refinery.refineryEnabled ? 'DESLIGAR REFINARIA' : 'LIGAR REFINARIA';
      refineryButton.disabled = refinery.controlAllowed === false;
    }
    if (transferButton) {
      transferButton.dataset.enabled = String(Boolean(refinery.transferEnabled));
      transferButton.textContent = refinery.transferEnabled ? 'DESATIVAR TRANSFERÊNCIA' : 'ATIVAR TRANSFERÊNCIA';
      transferButton.disabled = refinery.controlAllowed === false;
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
    renderTelemetry(moduleData);
    renderPowerControls(moduleData, selectedModuleId || selectedModule, open);
    updateSelection();
  }

  function unmount() {
    layer?.remove();
    layer = null;
    openHandler = null;
    closeHandler = null;
    selectHandler = null;
    powerCommandHandler = null;
  }
  return Object.freeze({ mount, render, selectModule, unmount });
}
