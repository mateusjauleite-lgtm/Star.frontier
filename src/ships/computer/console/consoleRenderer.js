import template from './console.html?raw';
import './console.css';

export function createShipConsoleRenderer({ root, html = template } = {}) {
  if (!root || typeof root.append !== 'function') {
    throw new TypeError('O elemento raiz do console não foi encontrado.');
  }

  let layer = null;

  function mount() {
    if (layer) return false;
    const wrapper = document.createElement('div');
    wrapper.className = 'ship-console-layer';
    wrapper.innerHTML = html.trim();
    layer = wrapper.firstElementChild;
    if (!layer) throw new Error('O template do console está vazio.');
    root.append(layer);
    return true;
  }

  function render({ snapshot, open, modules = [] } = {}) {
    if (!layer) return;
    layer.hidden = !open;
    layer.setAttribute('aria-hidden', String(!open));

    const online = Boolean(snapshot?.online);
    const status = layer.querySelector('[data-console-status]');
    if (status) {
      status.textContent = online ? 'COMPUTADOR ONLINE' : 'EM ESPERA';
      status.dataset.state = online ? 'online' : 'standby';
    }

    const systemStates = new Map((snapshot?.systems ?? []).map(system => [system.id, system.status]));
    const list = layer.querySelector('[data-console-modules]');
    if (list) {
      list.replaceChildren();
      for (const module of modules) {
        const item = document.createElement('li');
        item.className = 'ship-console-module';
        const name = document.createElement('span');
        name.textContent = module.label;
        const state = document.createElement('small');
        const systemStatus = module.systemId ? systemStates.get(module.systemId) : null;
        state.textContent = systemStatus
          ? systemStatus.toUpperCase()
          : module.systemId ? 'AGUARDANDO' : 'PREPARADO';
        item.append(name, state);
        list.append(item);
      }
    }
  }

  function unmount() {
    layer?.remove();
    layer = null;
  }

  return Object.freeze({ mount, render, unmount });
}
