import template from './engineering-terminal.html?raw';
import '../managementTerminal/management-terminal.css';
import './engineering-terminal.css';

export function createEngineeringTerminalRenderer({
  root,
  onOpen = () => {},
  onClose = () => {},
  onStageSelect = () => {},
  onExitMode = () => {},
  onWarpToggle = () => {}
} = {}) {
  if (!root?.append) throw new TypeError('O elemento raiz do console de Engenharia não foi encontrado.');
  let layer = null;
  let present = false;
  let interactionAvailable = false;
  let opened = false;
  let telemetry = null;

  function mount() {
    if (layer) return false;
    const wrapper = document.createElement('div');
    wrapper.className = 'engineering-terminal-hud-layer';
    wrapper.innerHTML = template.trim();
    layer = wrapper;
    layer.addEventListener('click', event => {
      if (event.target.closest('[data-engineering-close]')) { onClose(); return; }
      const stage = event.target.closest('[data-engineering-stage]');
      if (stage) { onStageSelect(Number(stage.dataset.engineeringStage)); return; }
      const exit = event.target.closest('[data-engineering-exit-mode]');
      if (exit) { onExitMode(exit.dataset.engineeringExitMode); return; }
      if (event.target.closest('[data-engineering-warp-toggle]')) {
        onWarpToggle(!Boolean(telemetry?.warpDriveActive));
      }
    });
    root.append(layer);
    render();
    return true;
  }

  function setPresence(visible, canInteract = false) {
    present = Boolean(visible);
    interactionAvailable = present && Boolean(canInteract);
    render();
  }

  function setOpen(value) {
    opened = Boolean(value);
    render();
  }

  function update(nextTelemetry) {
    telemetry = nextTelemetry && typeof nextTelemetry === 'object' ? nextTelemetry : null;
    render();
  }

  function render() {
    if (!layer) return;
    const windowElement = layer.querySelector('[data-engineering-window]');
    layer.hidden = !present && !opened;
    if (windowElement) windowElement.hidden = !opened;
    const online = Boolean(telemetry?.available);
    const status = layer.querySelector('[data-engineering-status]');
    if (status) {
      status.textContent = opened && online ? 'ONLINE' : 'EM ESPERA';
      status.dataset.state = opened && online ? 'online' : 'standby';
    }
    const setText = (selector, value) => {
      const node = layer.querySelector(selector);
      if (node) node.textContent = String(value);
    };
    const active = Boolean(telemetry?.warpDriveActive);
    const stage = Number(telemetry?.warpStage) || 0;
    const selectedStage = Number(telemetry?.selectedWarpStage) || 5;
    const speed = Math.round(Number(telemetry?.speed) || 0);
    const dilithium = Math.max(0, Number(telemetry?.refinedDilithium) || 0);
    const transition = telemetry?.warpTransition || 'idle';
    const exitMode = telemetry?.warpExitMode === 'direct' ? 'direct' : 'smooth';
    setText('[data-engineering-core]', online ? 'ONLINE' : 'OFFLINE');
    setText('[data-engineering-stage]', active ? 'DOBRA ' + stage : 'INATIVO');
    setText('[data-engineering-speed]', speed);
    setText('[data-engineering-dilithium]', dilithium.toFixed(2) + ' u');
    setText('[data-engineering-propulsion]', active ? 'DOBRA ATIVA' : 'CONVENCIONAL');
    setText('[data-engineering-transition]', transition === 'entering' ? 'ACELERANDO' : transition === 'cruise' ? 'CRUZEIRO' : transition === 'exiting' ? 'SAÍDA' : 'ESTÁVEL');
    setText('[data-engineering-exit-label]', exitMode === 'direct' ? 'DIRETA' : 'SUAVE');

    layer.querySelectorAll('[data-engineering-stage]').forEach(button => {
      const selected = Number(button.dataset.engineeringStage) === selectedStage;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    layer.querySelectorAll('[data-engineering-exit-mode]').forEach(button => {
      const selected = button.dataset.engineeringExitMode === exitMode;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const alert = layer.querySelector('[data-engineering-alert]');
    if (alert) {
      const reason = telemetry?.warpShutdownReason;
      alert.textContent = reason === 'dilithium-depleted'
        ? 'ALERTA · RESERVA DE DILÍTIO ESGOTADA · DOBRA DESLIGADA'
        : 'SEM ALERTAS · SISTEMAS ESTÁVEIS';
      alert.classList.toggle('is-warning', Boolean(reason));
    }
    const toggle = layer.querySelector('[data-engineering-warp-toggle]');
    if (toggle) toggle.textContent = active ? 'DESATIVAR PROPULSÃO DE DOBRA' : 'ATIVAR PROPULSÃO DE DOBRA';
    layer.querySelectorAll('[data-engineering-stage],[data-engineering-exit-mode],[data-engineering-warp-toggle]').forEach(control => {
      control.disabled = !opened || !online;
    });
  }

  return Object.freeze({ mount, setPresence, setOpen, update, render });
}
