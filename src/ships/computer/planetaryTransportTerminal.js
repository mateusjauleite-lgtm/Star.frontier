const STYLE_ID = 'aurora-transporter-terminal-style';
const PANEL_ID = 'aurora-transporter-terminal';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function createPlanetaryTransportTerminal({
  computer, root = globalThis.document?.body,
  onRequestMapPick = () => {}, onDestinationConfirmed = () => {}, onOpenChange = () => {},
  terminalId = 'planetary-transport-console', mode = 'catalog', onReturnToShip = () => {}
} = {}) {
  if (!computer || !root || typeof computer.connectTerminal !== 'function' || typeof computer.dispatch !== 'function') {
    throw new TypeError('O terminal AURORA exige o Ship Computer e uma raiz visual.');
  }
  const doc = root.ownerDocument || document;
  injectStyles(doc);
  const panelId = PANEL_ID + '-' + terminalId;
  let panel = doc.getElementById(panelId);
  if (!panel) {
    panel = doc.createElement('section');
    panel.id = panelId;
    panel.className = 'aurora-transporter hidden';
    panel.setAttribute('aria-label', 'AURORA OS — Transporte planetário');
    root.appendChild(panel);
  }

  let present = false, canInteract = false, connected = false, opened = false;
  let selectedId = null, destinations = [], status = null, destroyed = false;

  function dispatch(command, payload = {}) {
    if (!connected || !computer.isTerminalConnected(terminalId)) return { ok: false, reason: 'terminal-disconnected' };
    return computer.dispatch(terminalId, 'planetary-transport', command, payload);
  }

  function refresh() {
    if (!connected) return null;
    const s = dispatch('status');
    const d = dispatch('search', { query: '' });
    status = s.ok ? s.result : null;
    destinations = d.ok && Array.isArray(d.result) ? d.result : [];
    if (selectedId && !destinations.some(item => item.id === selectedId)) selectedId = null;
    if (opened) render();
    return status;
  }

  function render() {
    if (!opened || destroyed) return;
    const power = status?.power || {};
    const cost = Number(status?.energyCost || 0);
    const ready = Boolean(power.available && Number(power.energy) >= cost);
    const selected = destinations.find(item => item.id === selectedId);
    const header = '<header class="aurora-tp-header"><div><span>AURORA OS // AURORA-7 // '+(mode === 'return' ? 'BASE BT-01' : 'DECK 2')+'</span><h2>TRANSPORTE PLANETÁRIO</h2><p>'+(mode === 'return' ? 'Terminal terrestre · conexão de retorno' : 'Catálogo de bases terrestres conectadas')+'</p></div>'+
      '<div class="aurora-tp-head-actions"><b class="'+(ready ? 'online' : 'offline')+'">'+(ready ? 'EPS DISPONÍVEL' : 'EPS INDISPONÍVEL')+'</b><button type="button" data-tp-close aria-label="Fechar">×</button></div></header>';
    if (mode === 'return') {
      panel.innerHTML = header+
        '<main class="aurora-tp-main"><section class="aurora-tp-card"><div class="aurora-tp-heading"><div><span>BASE TERRESTRE BRASIL · BT-01</span><h3>Retorno à nave</h3></div><b>LINK ATIVO</b></div>'+
        '<p class="aurora-tp-note">O terminal está conectado ao Ship Computer da AURORA-7. A transferência será feita para a plataforma do Deck 2 e consumirá '+cost.toFixed(1)+' unidades de energia do barramento OPERATIONS EPS.</p>'+
        '<div class="aurora-tp-selection"><div><span>DESTINO</span><b>Plataforma de transporte · Deck 2</b></div>'+
        '<button type="button" class="aurora-tp-button" data-tp-return '+(ready ? '' : 'disabled')+'>RETORNAR À NAVE</button></div>'+
        '<div class="aurora-tp-power"><span class="'+(ready ? 'online' : 'offline')+'">● '+(ready ? 'SISTEMA ENERGIZADO' : 'AGUARDANDO ENERGIA')+'</span><span>'+Number(power.energy || 0).toFixed(1)+' / '+cost.toFixed(1)+' EPS</span></div>'+
        '</section></main><footer class="aurora-tp-footer"><span>BT-01 · JAÚ, SÃO PAULO, BRASIL</span><span>LINK AURORA-7: '+(connected ? 'CONECTADO' : 'OFFLINE')+'</span></footer>';
      panel.querySelector('[data-tp-close]')?.addEventListener('click', close);
      panel.querySelector('[data-tp-return]')?.addEventListener('click', () => {
        const response = dispatch('returnToShip');
        if (!response?.ok || !response.result?.ok) {
          announce('Retorno recusado: '+(response?.result?.reason || response?.reason || 'falha de conexão'));
          refresh();
          return;
        }
        onReturnToShip(response.result);
        close();
      });
      return;
    }

    const rows = destinations.map(item =>
      '<button type="button" class="aurora-tp-destination '+(item.id === selectedId ? 'is-selected' : '')+'" data-tp-select="'+esc(item.id)+'">'+
      '<span><b>'+esc(item.name)+'</b><small>'+esc(item.region || (item.bodyId === 'earth' ? 'TERRA' : item.bodyId.toUpperCase()))+' · BASE OPERACIONAL</small></span>'+
      '<i>'+(item.id === selectedId ? 'SELECIONADA' : 'SELECIONAR')+'</i></button>'
    ).join('');
    panel.innerHTML = header+
      '<main class="aurora-tp-main"><section class="aurora-tp-card">'+
      '<div class="aurora-tp-heading"><div><span>CATÁLOGO DE ESTAÇÕES</span><h3>Escolha uma base terrestre</h3></div><b>'+destinations.length+' BASE(S)</b></div>'+
      '<p class="aurora-tp-note">Selecione uma instalação física registrada no terreno da Terra. Depois de confirmar, dirija-se à plataforma do Deck 2 para iniciar o transporte.</p>'+
      '<div class="aurora-tp-list">'+(rows || '<p class="aurora-tp-empty">Nenhuma base terrestre conectada.</p>')+'</div>'+
      '<div class="aurora-tp-selection"><div><span>BASE SELECIONADA</span><b>'+(selected ? esc(selected.name) : 'Nenhuma base selecionada')+'</b></div>'+
      '<button type="button" class="aurora-tp-button" data-tp-confirm '+(selected ? '' : 'disabled')+'>CONFIRMAR BASE</button></div>'+
      '<div class="aurora-tp-power"><span class="'+(ready ? 'online' : 'offline')+'">● '+(ready ? 'SISTEMA ENERGIZADO' : 'AGUARDANDO ENERGIA')+'</span><span>'+Number(power.energy || 0).toFixed(1)+' / '+cost.toFixed(1)+' EPS</span></div>'+
      '</section></main><footer class="aurora-tp-footer"><span>AURORA OS · TRANSPORTE</span><span>SHIP COMPUTER: CONECTADO</span></footer>';

    panel.querySelector('[data-tp-close]')?.addEventListener('click', close);
    panel.querySelectorAll('[data-tp-select]').forEach(button => button.addEventListener('click', () => {
      selectedId = button.dataset.tpSelect;
      render();
    }));
    panel.querySelector('[data-tp-confirm]')?.addEventListener('click', () => {
      const destination = destinations.find(item => item.id === selectedId);
      if (!destination) return;
      onDestinationConfirmed(destination);
      suspend();
    });
  }

  function announce(message) {
    const toast = doc.getElementById('toast');
    if (toast) { toast.textContent = String(message); toast.classList.remove('hidden'); }
  }

  function open(operator = 'PILOTO') {
    if (destroyed || !present || !canInteract) return false;
    if (!computer.isTerminalConnected(terminalId) && !computer.connectTerminal(terminalId, operator)) return false;
    connected = true; opened = true;
    panel.classList.remove('hidden'); panel.setAttribute('aria-hidden', 'false');
    refresh(); onOpenChange(true);
    return true;
  }

  function suspend() {
    if (!opened) return false;
    opened = false; panel.classList.add('hidden'); panel.setAttribute('aria-hidden', 'true');
    onOpenChange(false);
    return true;
  }

  function resume() {
    if (destroyed || !connected || !computer.isTerminalConnected(terminalId)) return false;
    opened = true; panel.classList.remove('hidden'); panel.setAttribute('aria-hidden', 'false');
    refresh(); onOpenChange(true);
    return true;
  }

  function registerMapDestination({ latitudeDeg, longitudeDeg } = {}) {
    if (!connected || !computer.isTerminalConnected(terminalId)) return { ok: false, reason: 'terminal-disconnected' };
    const index = destinations.length + 1;
    const id = 'earth-map-' + Date.now().toString(36);
    const result = dispatch('registerCoordinate', {
      id, name: 'Destino terrestre ' + String(index).padStart(2, '0'),
      latitudeDeg, longitudeDeg, elevationMeters: 0, source: 'surface-map-pick'
    });
    if (!result.ok || !result.result?.id) {
      const detail = result.result?.message || result.result?.reason || result.reason || 'Não foi possível validar esse ponto.';
      announce(detail);
      resume();
      return { ok: false, reason: detail };
    }
    selectedId = result.result.id;
    refresh();
    announce('Ponto marcado na Terra. Confirme o destino para preparar o transporte.');
    resume();
    return { ok: true, destination: result.result };
  }

  function close() {
    suspend();
    if (connected || computer.isTerminalConnected(terminalId)) computer.disconnectTerminal(terminalId);
    connected = false;
    return true;
  }

  function setPresence(visible, available = false) {
    present = Boolean(visible); canInteract = present && Boolean(available);
    if (!present) close();
    return true;
  }

  function destroy() { if (destroyed) return; close(); panel.remove(); destroyed = true; }

  return Object.freeze({
    open, close, suspend, resume, setPresence, dispatch, refresh,
    registerMapDestination, destroy,
    getSnapshot: () => ({ present, interactionAvailable: canInteract, connected, open: opened, terminalId, selectedId })
  });
}

function injectStyles(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style'); style.id = STYLE_ID;
  style.textContent =
    '.aurora-transporter{position:fixed;inset:max(10px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));z-index:95;display:flex;flex-direction:column;gap:13px;box-sizing:border-box;padding:clamp(13px,2.2vw,25px);overflow:auto;color:#e8f6ff;background:radial-gradient(ellipse at 85% 0%,rgba(26,119,178,.2),transparent 42%),linear-gradient(145deg,#030b18,#081a2d 55%,#020812);border:1px solid rgba(104,202,238,.35);border-radius:15px;box-shadow:0 22px 70px rgba(0,0,0,.56);font-family:Arial,Helvetica,sans-serif}'+
    '.aurora-transporter.hidden{display:none!important}.aurora-transporter *{box-sizing:border-box}'+
    '.aurora-tp-header{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding-bottom:13px;border-bottom:1px solid rgba(111,196,232,.2)}'+
    '.aurora-tp-header span,.aurora-tp-heading span,.aurora-tp-selection span{color:#78a9c5;font-size:9px;font-weight:700;letter-spacing:1.1px;line-height:1.45}'+
    '.aurora-tp-header h2{margin:6px 0 4px;color:#e9f8ff;font-size:clamp(18px,3.4vw,27px);line-height:1.2;letter-spacing:1px}.aurora-tp-header p{margin:0;color:#91aabd;font-size:11px;line-height:1.45}'+
    '.aurora-tp-head-actions{display:flex;align-items:center;gap:10px}.aurora-tp-head-actions b{padding:7px 9px;border:1px solid rgba(145,176,197,.28);border-radius:5px;color:#9bb8ca;font-size:9px;white-space:nowrap}.aurora-tp-head-actions button{width:38px;height:38px;border:1px solid rgba(131,190,218,.28);border-radius:50%;color:#dff6ff;background:#102b43;font-size:24px}'+
    '.aurora-tp-main{width:min(100%,760px);margin:auto;flex:1;display:flex;align-items:center}.aurora-tp-card{width:100%;display:flex;flex-direction:column;gap:14px;padding:clamp(14px,2.2vw,22px);border:1px solid rgba(102,177,213,.2);border-radius:11px;background:rgba(5,20,36,.86)}.aurora-tp-heading{display:flex;justify-content:space-between;align-items:center;gap:10px}.aurora-tp-heading h3{margin:4px 0 0;color:#e3f5ff;font-size:17px}.aurora-tp-heading>b{padding:7px 9px;border:1px solid rgba(145,176,197,.28);border-radius:5px;color:#9bb8ca;font-size:9px;white-space:nowrap}'+
    '.aurora-tp-note,.aurora-tp-empty{margin:0;color:#9ab4c6;font-size:12px;line-height:1.6}.aurora-tp-button{min-height:44px;padding:11px 14px;border:1px solid #75dff8;border-radius:7px;color:#061421;background:linear-gradient(110deg,#70d8f2,#68a9ff);font-size:11px;font-weight:800;letter-spacing:.5px}.aurora-tp-button:disabled{opacity:.38}.aurora-tp-button.mark{color:#dff8ff;border-color:rgba(105,210,245,.55);background:linear-gradient(110deg,rgba(16,75,108,.9),rgba(11,43,75,.95))}'+
    '.aurora-tp-list{display:flex;flex-direction:column;gap:7px;max-height:230px;overflow:auto}.aurora-tp-destination{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:54px;padding:10px 12px;text-align:left;border:1px solid rgba(96,169,207,.2);border-radius:7px;color:#e4f4ff;background:rgba(13,37,58,.72)}.aurora-tp-destination.is-selected{border-color:rgba(89,220,255,.65);background:rgba(17,83,111,.55)}.aurora-tp-destination span{display:flex;flex-direction:column;gap:4px;min-width:0}.aurora-tp-destination b{font-size:12px}.aurora-tp-destination small,.aurora-tp-destination i{color:#8eafc4;font-size:9px;font-style:normal}.aurora-tp-destination i{flex:0 0 auto}.aurora-tp-selection{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-top:12px;border-top:1px solid rgba(102,177,213,.16)}.aurora-tp-selection>div{display:flex;flex-direction:column;gap:5px;min-width:0}.aurora-tp-selection b{color:#e8f7ff;font-size:12px;overflow-wrap:anywhere}.aurora-tp-power{display:flex;justify-content:space-between;gap:10px;padding-top:10px;border-top:1px solid rgba(102,177,213,.14);color:#91aabd;font-size:10px}.online{color:#83e9c2!important}.offline{color:#ffbf91!important}.aurora-tp-footer{display:flex;justify-content:space-between;flex-wrap:wrap;gap:7px;padding-top:10px;border-top:1px solid rgba(111,196,232,.16);color:#6f94ab;font-size:8px;letter-spacing:.65px}'+
    '@media(max-width:560px){.aurora-transporter{border-radius:10px;gap:10px}.aurora-tp-header{flex-direction:column}.aurora-tp-head-actions{width:100%;justify-content:space-between}.aurora-tp-selection{align-items:stretch;flex-direction:column}}';
  doc.head.appendChild(style);
}

export function createTransporterActionMenu({ root = globalThis.document?.body, onConfirm = () => {} } = {}) {
  if (!root) throw new TypeError('Menu de ação do teletransporte sem raiz visual.');
  const doc = root.ownerDocument || document;
  const menu = doc.createElement('section'); menu.className = 'transporter-action-menu hidden';
  menu.setAttribute('aria-label', 'Ação de teletransporte');
  menu.innerHTML = '<section class="transporter-platform-os"><header><span>AURORA OS // AURORA-7</span><b>PLATAFORMA DE TRANSPORTE</b><small>DESTINO RECEBIDO · LINK COM SHIP COMPUTER</small></header><div class="transporter-action-orbit"><button type="button" class="transporter-action-primary">ACIONAR</button><div class="transporter-action-confirm hidden"><button type="button" data-tp-yes>CONFIRMAR</button><button type="button" data-tp-no>CANCELAR</button></div></div></section>';
  if (!doc.getElementById('transporter-action-menu-style')) {
    const style = doc.createElement('style'); style.id = 'transporter-action-menu-style';
    style.textContent = '.transporter-action-menu{position:fixed;inset:0;z-index:110;display:grid;place-items:center;pointer-events:none;background:rgba(1,8,17,.48);backdrop-filter:blur(4px)}.transporter-action-menu.hidden{display:none}.transporter-platform-os{display:flex;flex-direction:column;align-items:center;gap:22px;min-width:min(86vw,340px);padding:22px 20px;border:1px solid rgba(91,210,255,.48);border-radius:14px;background:linear-gradient(145deg,#061526,#0b2942 58%,#030c18);box-shadow:0 18px 60px rgba(0,0,0,.55),inset 0 0 24px rgba(80,194,255,.08);pointer-events:auto;color:#e9faff;font-family:Arial,Helvetica,sans-serif}.transporter-platform-os header{display:flex;flex-direction:column;align-items:center;gap:7px;text-align:center}.transporter-platform-os header span{color:#73dafa;font-size:9px;font-weight:800;letter-spacing:1.5px}.transporter-platform-os header b{font-size:14px;letter-spacing:1px}.transporter-platform-os header small{color:#8fb4ca;font-size:9px;letter-spacing:.7px}.transporter-action-orbit{position:relative;display:grid;place-items:center;width:116px;height:116px;border:1px solid rgba(91,210,255,.48);border-radius:50%;background:radial-gradient(circle,rgba(19,79,112,.94),rgba(3,15,30,.96) 72%);box-shadow:0 0 30px rgba(43,177,239,.22),inset 0 0 18px rgba(80,194,255,.16);pointer-events:auto}.transporter-action-menu button{display:grid;place-items:center;width:82px;height:82px;border:1px solid rgba(112,224,255,.7);border-radius:50%;color:#e9faff;background:linear-gradient(145deg,#145c83,#09243e);font-size:11px;font-weight:800;letter-spacing:.4px}.transporter-action-confirm{position:absolute;inset:-34px;display:flex;align-items:center;justify-content:space-between}.transporter-action-confirm.hidden{display:none}.transporter-action-confirm button{width:68px;height:68px;font-size:9px}.transporter-action-confirm [data-tp-yes]{width:82px;height:82px;font-size:9px}.transporter-action-confirm [data-tp-yes]{border-color:rgba(105,238,185,.72)}.transporter-action-confirm [data-tp-no]{border-color:rgba(255,157,157,.62)}';
    doc.head.appendChild(style);
  }
  root.appendChild(menu);
  const primary = menu.querySelector('.transporter-action-primary'), confirm = menu.querySelector('.transporter-action-confirm');
  const close = () => { menu.classList.add('hidden'); confirm.classList.add('hidden'); };
  primary.addEventListener('click', () => { primary.classList.add('hidden'); confirm.classList.remove('hidden'); });
  menu.querySelector('[data-tp-no]').addEventListener('click', close);
  menu.querySelector('[data-tp-yes]').addEventListener('click', () => { close(); onConfirm(); });
  return Object.freeze({ open() { primary.classList.remove('hidden'); confirm.classList.add('hidden'); menu.classList.remove('hidden'); }, close, dispose() { close(); menu.remove(); }, isOpen: () => !menu.classList.contains('hidden') });
}
