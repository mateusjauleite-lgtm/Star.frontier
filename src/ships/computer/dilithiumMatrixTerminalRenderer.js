import template from './dilithium-matrix-terminal.html?raw';
import '../managementTerminal/management-terminal.css';
import './dilithium-matrix-terminal.css';

const VIEWS = {
  overview: ['Matriz de dilítio', 'Estado operacional e reserva de plasma estabilizado.'],
  production: ['Produção e plasma', 'Conversão de dilítio refinado e balanço de plasma.'],
  buses: ['Barramentos EPS', 'Capacidade, reserva e entrega por barramento.'],
  consumption: ['Consumo e distribuição', 'Geração, entrega e utilização da energia disponível.'],
  branches: ['Ramificações do defletor', 'Consumo real dos cinco módulos alimentados pelo barramento Warp/Defletor.'],
  diagnostics: ['Diagnóstico e segurança', 'Intertravamentos, contenção e condições de operação.']
};

export function createDilithiumMatrixTerminalRenderer({ root } = {}) {
  if (!root?.append) throw new TypeError('Raiz do terminal da matriz ausente.');
  let layer = null, present = false, opened = false, data = null, view = 'overview', handlers = {};
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const units = value => number(value).toFixed(2) + ' u';
  const percent = value => (Math.max(0, Math.min(1, number(value))) * 100).toFixed(0) + '%';
  function mount(next = {}) {
    if (layer) return false;
    const node = document.createElement('div');
    node.className = 'dilithium-matrix-hud-layer';
    node.innerHTML = template.trim();
    layer = node;
    handlers = next;
    layer.addEventListener('click', event => {
      if (event.target.closest('[data-matrix-close]')) { handlers.onClose?.(); return; }
      const tab = event.target.closest('[data-matrix-view]');
      if (tab) { view = tab.dataset.matrixView; render(); return; }
      const command = event.target.closest('[data-matrix-command]');
      if (command) {
        const [systemId, name] = command.dataset.matrixCommand.split(':');
        const enabled = command.dataset.matrixEnabled === 'true';
        handlers.onCommand?.(systemId, name, { enabled: !enabled });
      }
    });
    layer.addEventListener('change', event => {
      if (event.target.matches('[data-matrix-regulation]')) {
        handlers.onCommand?.('matrix', 'setRegulation', { regulation: number(event.target.value) / 100 });
      }
    });
    root.append(node);
    render();
    return true;
  }
  function setPresence(value) { present = Boolean(value); render(); }
  function setOpen(value) { opened = Boolean(value); render(); }
  function update(value) { data = value && typeof value === 'object' ? value : null; render(); }
  function render() {
    if (!layer) return;
    layer.hidden = !present && !opened;
    const win = layer.querySelector('[data-matrix-window]');
    if (win) win.hidden = !opened;
    const txt = (selector, value) => { const node = layer.querySelector(selector); if (node) node.textContent = String(value); };
    const fill = (selector, value) => { const node = layer.querySelector(selector); if (node) node.style.width = percent(value); };
    const p = data?.power || {}, matrix = p.matrix || {}, plasma = p.plasma || {}, buses = p.buses || {};
    const deflector = data?.deflector || {};
    const branchIds = { emitter: 'deflector-emitter', sensors: 'deflector-sensors', navigation: 'deflector-navigation', protection: 'deflector-protection', science: 'deflector-science' };
    const branches = [
      ['emitter', 'Emissor', deflector.emitter],
      ['sensors', 'Sensores', deflector.sensors],
      ['navigation', 'Navegação', deflector.navigation],
      ['protection', 'Proteção', deflector.protection],
      ['science', 'Ciência', deflector.science]
    ].map(([id, label, module]) => [id, label, module, (deflector.branches || []).find(branch => branch.id === branchIds[id])]);
    const online = Boolean(data?.available && matrix.online);
    const status = layer.querySelector('[data-matrix-status]');
    if (status) { status.textContent = opened && online ? 'ONLINE' : opened ? 'ATENÇÃO' : 'EM ESPERA'; status.dataset.state = online ? 'online' : 'standby'; }
    txt('[data-matrix-state]', matrix.online ? 'MATRIZ ONLINE' : matrix.enabled ? 'AGUARDANDO ENERGIA' : 'MATRIZ DESLIGADA');
    txt('[data-matrix-plasma]', units(plasma.amount));
    txt('[data-matrix-feedstock]', units(matrix.dilithiumFeedstock));
    txt('[data-matrix-output]', number(p.outputPerSecond).toFixed(2) + ' u/s');
    txt('[data-matrix-regulation-label]', percent(matrix.regulation));
    txt('[data-matrix-phase]', p.phase || 'indisponível');
    txt('[data-matrix-containment]', p.containmentStable ? 'ESTÁVEL' : 'INSTÁVEL');
    txt('[data-matrix-produced]', units(plasma.producedTotal));
    txt('[data-matrix-consumed]', units(plasma.consumedTotal));
    txt('[data-matrix-conversion]', units(matrix.dilithiumConvertedTotal));
    txt('[data-matrix-plasma-rate]', number(plasma.consumptionRate).toFixed(3) + ' u/s');
    txt('[data-matrix-generated]', units(p.generatedTotal));
    txt('[data-matrix-delivered]', units(p.deliveredTotal));
    txt('[data-matrix-deflector-transferred]', units(deflector.transferredTotal));
    txt('[data-matrix-deflector-consumed]', units(deflector.consumedTotal));
    txt('[data-matrix-deflector-rates]', number(deflector.transferRate).toFixed(2) + ' / ' + number(deflector.consumptionRate).toFixed(2) + ' u/s');
    txt('[data-matrix-deflector-energy]', units(deflector.energy));
    txt('[data-matrix-deflector-capacity]', units(deflector.capacity));
    fill('[data-matrix-plasma-fill]', plasma.capacity ? plasma.amount / plasma.capacity : 0);
    fill('[data-matrix-deflector-fill]', deflector.fill);
    for (const [key, bus] of Object.entries({ critical: buses.critical, operations: buses.operations, warp: buses.warp })) {
      txt('[data-matrix-bus-' + key + ']', units(bus?.energy));
      txt('[data-matrix-bus-' + key + '-capacity]', units(bus?.capacity));
      fill('[data-matrix-bus-' + key + '-fill]', bus?.fill);
    }
    const branchRoot = layer.querySelector('[data-matrix-branches]');
    if (branchRoot) branchRoot.innerHTML = branches.map(([id, label, item, coreBranch]) => {
      const entry = item || {}, usage = coreBranch || {};
      const details = id === 'emitter' ? 'CAMPO ' + percent(entry.fieldStrength) + ' · TAXA NOMINAL ' + number(entry.energyPerSecond).toFixed(2) + ' u/s'
        : id === 'sensors' ? 'SINAL ' + percent(entry.signalQuality) + ' · CONTATOS ' + number(entry.totalContacts)
          : id === 'navigation' ? 'RISCO ' + String(entry.routeRisk || 'indefinido').toUpperCase() + ' · VELOCIDADE ' + number(entry.speed).toFixed(0)
            : id === 'protection' ? 'FORÇA ' + percent(entry.strength) + ' · ' + String(entry.reason || 'standby').toUpperCase()
              : 'MODO ' + String(entry.mode || 'passive').toUpperCase() + ' · PULSOS ' + units(entry.pulseTotal);
      return '<article class="matrix-branch-row"><span><b>' + label + '</b><small>' + (usage.enabled === false ? 'DESATIVADA' : (entry.active || entry.available || entry.operational) ? 'ATIVA' : 'EM ESPERA') + '</small></span><strong>' + number(usage.consumptionRate).toFixed(3) + ' u/s</strong><small>TOTAL CONSUMIDO ' + units(usage.consumedTotal) + '</small><small class="matrix-branch-detail">' + details + '</small></article>';
    }).join('');
    const enabled = Boolean(matrix.enabled);
    const toggle = layer.querySelector('[data-matrix-command="matrix:setEnabled"]');
    if (toggle) { toggle.textContent = enabled ? 'DESLIGAR MATRIZ' : 'ATIVAR MATRIZ'; toggle.dataset.matrixEnabled = String(enabled); toggle.disabled = !opened || !data?.available || (enabled && (Boolean(data?.warpDriveActive) || ['entering', 'cruise', 'reducing', 'exiting'].includes(data?.warpTransition))); }
    const regulation = layer.querySelector('[data-matrix-regulation]');
    if (regulation) { regulation.value = String(Math.round(number(matrix.regulation) * 100)); regulation.disabled = !opened || !data?.available; }
    const diag = layer.querySelector('[data-matrix-diagnostic]');
    if (diag) diag.textContent = data?.warpDriveActive || ['entering', 'cruise', 'reducing', 'exiting'].includes(data?.warpTransition) ? 'INTERTRAVA ATIVO · DOBRA EM OPERAÇÃO' : matrix.online ? 'SEM BLOQUEIOS · MATRIZ OPERACIONAL' : 'VERIFIQUE NÚCLEO, CONTENÇÃO E RESERVA DE PLASMA';
    layer.querySelectorAll('[data-matrix-view]').forEach(button => {
      const selected = button.dataset.matrixView === view;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    layer.querySelectorAll('[data-matrix-panel]').forEach(panel => { panel.hidden = panel.dataset.matrixPanel !== view; });
    const title = VIEWS[view] || VIEWS.overview;
    txt('[data-matrix-page-title]', title[0]);
    txt('[data-matrix-page-description]', title[1]);
  }
  function unmount() { layer?.remove(); layer = null; data = null; handlers = {}; }
  return Object.freeze({ mount, setPresence, setOpen, update, unmount, render });
}
