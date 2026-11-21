import template from './management-terminal.html?raw';
import './management-terminal.css';

export function createShipManagementTerminalRenderer({ root, html = template } = {}) {
  if (!root || typeof root.append !== 'function') {
    throw new TypeError('O elemento raiz do terminal holográfico não foi encontrado.');
  }

  let layer = null;
  let selectedModule = 'navigation';
  let closeHandler = null;
  let selectHandler = null;

  function mount({ onClose = () => {}, onModuleSelect = () => {} } = {}) {
    if (layer) return false;
    const wrapper = document.createElement('div');
    wrapper.className = 'ship-management-terminal-layer';
    wrapper.innerHTML = html.trim();
    if (!wrapper.firstElementChild) throw new Error('O template do terminal de gerenciamento está vazio.');
    layer = wrapper;
    closeHandler = onClose;
    selectHandler = onModuleSelect;
    layer.addEventListener('click', event => {
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

  function render({ snapshot, present, open } = {}) {
    if (!layer) return;
    layer.hidden = !present;
    layer.dataset.mode = open ? 'interactive' : 'passive';
    layer.setAttribute('aria-hidden', String(!present));

    layer.querySelectorAll('[data-management-status]').forEach(status => {
      status.textContent = snapshot?.online ? 'SHIP COMPUTER ONLINE' : 'SISTEMA EM ESPERA';
      status.dataset.state = snapshot?.online ? 'online' : 'standby';
    });

    const interaction = layer.querySelector('[data-management-interaction]');
    if (interaction) interaction.hidden = !open;

    const prompt = layer.querySelector('[data-management-prompt]');
    if (prompt) prompt.hidden = open;

    const systemStates = new Map((snapshot?.systems ?? []).map(system => [system.id, system.status]));
    layer.querySelectorAll('[data-management-module]').forEach(button => {
      const moduleId = button.dataset.managementModule;
      const module = button.querySelector('[data-module-state]');
      const systemId = button.dataset.systemId;
      if (module) {
        const state = systemId ? systemStates.get(systemId) : null;
        module.textContent = state ? state.toUpperCase() : 'PREPARADO';
      }
    });
    updateSelection();
  }

  function unmount() {
    layer?.remove();
    layer = null;
    closeHandler = null;
    selectHandler = null;
  }

  return Object.freeze({ mount, render, selectModule, unmount });
}
