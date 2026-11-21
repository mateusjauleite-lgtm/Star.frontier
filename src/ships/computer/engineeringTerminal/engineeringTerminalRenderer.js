import { WARP_STAGE_SPEEDS } from '../../flight/flightDynamics.js';
import template from './engineering-terminal.html?raw';
import '../managementTerminal/management-terminal.css';
import './engineering-terminal.css';

export function createEngineeringTerminalRenderer({
  root,
  onClose = () => {},
  onStageSelect = () => {},
  onExitMode = () => {},
  onWarpToggle = () => {},
  onRefineryToggle = () => {},
  onTransferToggle = () => {}
} = {}) {
  if (!root?.append) throw new TypeError('O elemento raiz do console de Engenharia não foi encontrado.');
  let layer = null;
  let present = false;
  let opened = false;
  let telemetry = null;
  let selectedApp = 'propulsion';
  let selectedView = 'storage';

  function mount() {
    if (layer) return false;
    const wrapper = document.createElement('div');
    wrapper.className = 'engineering-terminal-hud-layer';
    wrapper.innerHTML = template.trim();
    layer = wrapper;
    layer.addEventListener('click', event => {
      if (event.target.closest('[data-engineering-close]')) { onClose(); return; }
      const app = event.target.closest('[data-engineering-app-select]');
      if (app) { selectedApp = app.dataset.engineeringAppSelect; render(); return; }
      const view = event.target.closest('[data-engineering-view]');
      if (view) { selectedView = view.dataset.engineeringView; render(); return; }
      const stage = event.target.closest('[data-engineering-stage]');
      if (stage) { onStageSelect(Number(stage.dataset.engineeringStage)); return; }
      const exit = event.target.closest('[data-engineering-exit-mode]');
      if (exit) { onExitMode(exit.dataset.engineeringExitMode); return; }
      if (event.target.closest('[data-engineering-warp-toggle]')) {
        onWarpToggle(!Boolean(telemetry?.warpDriveActive)); return;
      }
      if (event.target.closest('[data-refinery-main-toggle]')) {
        onRefineryToggle(!Boolean(telemetry?.refinery?.refineryEnabled)); return;
      }
      if (event.target.closest('[data-refinery-transfer-toggle], [data-refinery-command-transfer-toggle]')) {
        onTransferToggle(!Boolean(telemetry?.refinery?.transferEnabled));
      }
    });
    root.append(layer);
    render();
    return true;
  }

  function setPresence(visible) {
    present = Boolean(visible);
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
    const setFill = (selector, value) => {
      const node = layer.querySelector(selector);
      if (node) node.style.width = (Math.max(0, Math.min(1, Number(value) || 0)) * 100) + '%';
    };
    const active = Boolean(telemetry?.warpDriveActive);
    const stage = Number(telemetry?.warpStage) || 0;
    const selectedStage = Number(telemetry?.selectedWarpStage) || 5;
    const speed = Math.round(Number(telemetry?.speed) || 0);
    const dilithium = Math.max(0, Number(telemetry?.refinedDilithium) || 0);
    const transition = telemetry?.warpTransition || 'idle';
    const exitMode = telemetry?.warpExitMode === 'direct' ? 'direct' : 'smooth';
    const refinery = telemetry?.refinery || {};
    const raw = Number(refinery.rawOre) || 0;
    const rawCapacity = Number(refinery.rawCapacity) || 1;
    const buffer = Number(refinery.refinedBuffer) || 0;
    const bufferCapacity = Number(refinery.refinedCapacity) || 1;
    const core = Number(refinery.coreDilithium) || 0;
    const coreCapacity = Number(refinery.coreCapacity) || 1;
    const transferOn = Boolean(refinery.transferEnabled);
    const refineryOn = Boolean(refinery.refineryEnabled);
    const canControl = refinery.controlAllowed !== false;
    const units = value => (Number(value) || 0).toFixed(2) + ' u';

    setText('[data-engineering-core]', online ? 'ONLINE' : 'OFFLINE');
    setText('[data-engineering-stage]', active ? 'DOBRA ' + stage : 'INATIVO');
    setText('[data-engineering-speed]', speed);
    setText('[data-engineering-dilithium]', dilithium.toFixed(2) + ' u');
    setText('[data-engineering-propulsion]', active ? 'DOBRA ATIVA' : 'CONVENCIONAL');
    setText('[data-engineering-transition]', transition === 'entering' ? 'ACELERANDO' : transition === 'cruise' ? 'CRUZEIRO' : transition === 'reducing' ? 'AJUSTANDO' : transition === 'exiting' ? 'SAÍDA' : 'ESTÁVEL');
    setText('[data-engineering-exit-label]', exitMode === 'direct' ? 'DIRETA' : 'SUAVE');

    layer.querySelectorAll('[data-engineering-app-select]').forEach(button => {
      const selected = button.dataset.engineeringAppSelect === selectedApp;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    layer.querySelectorAll('[data-engineering-app-panel]').forEach(panel => {
      panel.hidden = panel.dataset.engineeringAppPanel !== selectedApp;
    });
    layer.querySelectorAll('[data-engineering-view]').forEach(button => {
      const selected = button.dataset.engineeringView === selectedView;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    layer.querySelectorAll('[data-engineering-view-panel]').forEach(panel => {
      panel.hidden = panel.dataset.engineeringViewPanel !== selectedView;
    });
    setText('[data-engineering-page-title]', selectedApp === 'refinery' ? 'Refinaria e núcleo de energia' : 'Propulsão e núcleo de dobra');
    setText('[data-engineering-page-description]', selectedApp === 'refinery'
      ? 'Armazenamento, processamento e transferência de dilítio para o núcleo.'
      : 'Controle de estágio, velocidade e reserva refinada da nave.');

    layer.querySelectorAll('[data-engineering-stage]').forEach(button => {
      const stageNumber = Number(button.dataset.engineeringStage);
      const selected = stageNumber === selectedStage;
      const speedLabel = button.querySelector('small');
      if (speedLabel) speedLabel.textContent = String(WARP_STAGE_SPEEDS[stageNumber] || 0);
      button.classList.toggle('is-selected', selected);
      button.disabled = !opened || !online || !active;
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
    const warpToggle = layer.querySelector('[data-engineering-warp-toggle]');
    if (warpToggle) warpToggle.textContent = active ? 'DESATIVAR PROPULSÃO DE DOBRA' : 'ATIVAR PROPULSÃO DE DOBRA';
    layer.querySelectorAll('[data-engineering-exit-mode],[data-engineering-warp-toggle]').forEach(control => {
      control.disabled = !opened || !online;
    });

    setText('[data-refinery-raw]', units(raw));
    setText('[data-refinery-raw-capacity]', 'CAPACIDADE ' + units(rawCapacity));
    setFill('[data-refinery-raw-fill]', raw / rawCapacity);
    setText('[data-refinery-buffer]', units(buffer));
    setText('[data-refinery-buffer-capacity]', 'CAPACIDADE ' + units(bufferCapacity));
    setFill('[data-refinery-buffer-fill]', buffer / bufferCapacity);
    setText('[data-refinery-transfer-state]', transferOn ? 'ATIVA' : 'DESLIGADA');
    setText('[data-refinery-transfer-rate]', units(refinery.transferRate) + '/s');
    setText('[data-refinery-transferred-total]', units(refinery.transferredTotal));
    setFill('[data-refinery-transfer-fill]', core / coreCapacity);
    setText('[data-refinery-core]', units(core));
    setText('[data-refinery-core-capacity]', 'CAPACIDADE ' + units(coreCapacity));
    setFill('[data-refinery-core-fill]', core / coreCapacity);
    setText('[data-refinery-core-space]', units(refinery.coreRemainingCapacity));
    setText('[data-refinery-consumed-total]', units(refinery.consumedTotal));
    setText('[data-refinery-consumption-rate]', units(refinery.consumptionRate) + '/s');
    setText('[data-refinery-refined-total]', units(refinery.refinedTotal));
    setText('[data-refinery-support]', refinery.supportRange || 'AGUARDANDO TELEMETRIA');
    setText('[data-refinery-state]', refineryOn ? 'ONLINE' : 'DESLIGADA');
    setText('[data-refinery-command-transfer-state]', transferOn ? 'ATIVA' : 'DESLIGADA');
    const transferLabel = transferOn ? 'DESATIVAR TRANSFERÊNCIA' : 'ATIVAR TRANSFERÊNCIA';
    const transferButton = layer.querySelector('[data-refinery-transfer-toggle]');
    const commandTransferButton = layer.querySelector('[data-refinery-command-transfer-toggle]');
    if (transferButton) transferButton.textContent = transferLabel;
    if (commandTransferButton) commandTransferButton.textContent = transferLabel;
    const refineryButton = layer.querySelector('[data-refinery-main-toggle]');
    if (refineryButton) refineryButton.textContent = refineryOn ? 'DESLIGAR REFINARIA' : 'LIGAR REFINARIA';
    setText('[data-refinery-authority]', canControl
      ? 'CONTROLE LOCAL DISPONÍVEL · CONSOLE CENTRAL TEM PRIORIDADE'
      : 'CONTROLE BLOQUEADO · CONSOLE CENTRAL DE ENERGIA CONECTADO');
    layer.querySelectorAll('[data-refinery-main-toggle],[data-refinery-transfer-toggle],[data-refinery-command-transfer-toggle]').forEach(button => {
      button.disabled = !opened || !online || !canControl;
    });
  }

  return Object.freeze({ mount, setPresence, setOpen, update, render });
}
