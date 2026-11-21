import template from './management-terminal.html?raw';
import './management-terminal.css';

export function createShipManagementTerminalRenderer({ root, html = template } = {}) {
  if (!root || typeof root.append !== 'function') {
    throw new TypeError('O elemento raiz do HUD de gerenciamento não foi encontrado.');
  }

  let layer = null;
  let selectedModule = 'navigation';
  let openHandler = null;
  let closeHandler = null;
  let selectHandler = null;

  function mount({ onOpen = () => {}, onClose = () => {}, onModuleSelect = () => {} } = {}) {
    if (layer) return false;
    const wrapper = document.createElement('div');
    wrapper.className = 'ship-management-hud-layer';
    wrapper.innerHTML = html.trim();
    if (!wrapper.firstElementChild) throw new Error('O template do HUD de gerenciamento está vazio.');
    layer = wrapper;
    openHandler = onOpen;
    closeHandler = onClose;
    selectHandler = onModuleSelect;
    layer.addEventListener('click', event => {
      if (event.target.closest('[data-management-open]')) {
        openHandler?.();
        return;
      }
      if (event.target.closest('[data-management-close]')) {
        closeHandler?.();
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

  function selectModule(moduleId) {
    selectedModule = moduleId;
    updateSelection();
  }

  function render({ snapshot, present, interactionAvailable, open, modules = [] } = {}) {
    if (!layer) return;
    layer.hidden = !present && !open;
    layer.dataset.mode = open ? 'interactive' : 'passive';
    layer.setAttribute('aria-hidden', String(!present && !open));

    const openButton = layer.querySelector('[data-management-open]');
    if (openButton) {
      openButton.hidden = !interactionAvailable || open;
      openButton.disabled = !interactionAvailable || open;
    }

    const interaction = layer.querySelector('[data-management-interaction]');
    if (interaction) interaction.hidden = !open;

    layer.querySelectorAll('[data-management-status]').forEach(status => {
      status.textContent = snapshot?.online ? 'SHIP COMPUTER ONLINE' : 'SISTEMA EM ESPERA';
      status.dataset.state = snapshot?.online ? 'online' : 'standby';
    });

    const systemStates = new Map((snapshot?.systems ?? []).map(system => [system.id, system.status]));
    layer.querySelectorAll('[data-management-module]').forEach(button => {
      const systemId = button.dataset.systemId;
      const state = systemId ? systemStates.get(systemId) : null;
      const stateLabel = button.querySelector('[data-module-state]');
      if (stateLabel) stateLabel.textContent = state ? state.toUpperCase() : 'PREPARADO';
    });

    const connection = layer.querySelector('[data-management-connection]');
    if (connection) connection.textContent = snapshot?.online
      ? 'CONEXÃO CENTRAL ESTABELECIDA'
      : 'COMPUTADOR CENTRAL EM ESPERA';

    const moduleCount = layer.querySelector('[data-management-module-count]');
    if (moduleCount) moduleCount.textContent = String(modules.length).padStart(2, '0');

    updateSelection();
  }

  function unmount() {
    layer?.remove();
    layer = null;
    openHandler = null;
    closeHandler = null;
    selectHandler = null;
  }

  return Object.freeze({ mount, render, selectModule, unmount });
}
