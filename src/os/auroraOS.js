import { audioManager } from '../systems/audioManager.js';

const STYLE_ID = 'aurora-os-styles';
const VIEW_ID = 'aurora-os-view';

const APP_ITEMS = [
  { id: 'play', icon: '🚀', title: 'Hangar orbital', detail: 'Iniciar missão e acessar a nave' },
  { id: 'story', icon: '✦', title: 'História', detail: 'Campanha e registros narrativos' },
  { id: 'character', icon: '◉', title: 'Personagem', detail: 'Perfil do explorador' },
  { id: 'ships', icon: '▱', title: 'Naves', detail: 'Nave e equipamentos' },
  { id: 'shop', icon: '◇', title: 'Loja', detail: 'Equipamentos e recursos' },
  { id: 'settings', icon: '⚙', title: 'Configurações', detail: 'Gráficos e controles' }
];

const BUS_ITEMS = [
  { id: 'music', label: 'Música' },
  { id: 'sfx', label: 'Efeitos sonoros' },
  { id: 'ambience', label: 'Ambiente' },
  { id: 'voice', label: 'Voz' }
];

export function createAuroraOS({ documentRef = globalThis.document, manager = audioManager } = {}) {
  if (!documentRef || !manager) return { destroy() {} };

  const menu = documentRef.getElementById('menu-screen');
  const nav = menu?.querySelector('.menu-nav');
  const panel = menu?.querySelector('.menu-panel');
  if (!menu || !nav || !panel) return { destroy() {} };

  injectStyles(documentRef);
  buildNavigation(documentRef, nav);
  buildView(documentRef, panel);

  const view = documentRef.getElementById(VIEW_ID);
  let currentView = 'home';
  let destroyed = false;

  function showHome() {
    currentView = 'home';
    menu.classList.add('aurora-os-active');
    menu.classList.remove('aurora-legacy-app');
    renderHome();
    updateNavigationState();
  }

  function showAudio() {
    currentView = 'audio';
    menu.classList.add('aurora-os-active');
    menu.classList.remove('aurora-legacy-app');
    renderAudio();
    updateNavigationState();
  }

  function openLegacyApp(id) {
    const button = nav.querySelector('[data-panel="' + id + '"]');
    if (!button) return;
    currentView = 'app:' + id;
    menu.classList.remove('aurora-os-active');
    menu.classList.add('aurora-legacy-app');
    updateNavigationState();
    button.click();
  }

  function updateNavigationState() {
    nav.querySelectorAll('[data-aurora-view]').forEach(button => {
      button.classList.toggle('active', button.dataset.auroraView === currentView);
    });
    nav.querySelectorAll('[data-panel]').forEach(button => {
      button.classList.toggle('active', currentView === 'app:' + button.dataset.panel);
    });
  }

  function renderHome() {
    if (!view) return;
    const pilot = documentRef.getElementById('login-name')?.value?.trim() || 'PILOTO';
    const snapshot = manager.getSnapshot();
    view.innerHTML = `
      <header class="aurora-hero">
        <div>
          <span class="aurora-eyebrow">STAR FRONTIER // SISTEMA OPERACIONAL</span>
          <h1>AURORA OS</h1>
          <p>Interface central da nave. Aplicativos, preferências e recursos do ambiente de jogo.</p>
        </div>
        <div class="aurora-clock-card">
          <span>SESSÃO ATUAL</span>
          <b>${escapeHtml(pilot.toUpperCase())}</b>
          <small>AMBIENTE LOCAL · INDEPENDENTE DO SHIP COMPUTER</small>
        </div>
      </header>
      <section class="aurora-status-grid" aria-label="Estado do sistema">
        <article class="aurora-status-card"><span>SISTEMA</span><b><i class="aurora-status-dot"></i> OPERACIONAL</b><small>Interface AURORA OS ativa</small></article>
        <article class="aurora-status-card"><span>ÁUDIO</span><b>${snapshot.output.muted ? 'SILENCIADO' : 'CONFIGURÁVEL'}</b><small>Gerenciador central de áudio</small></article>
        <article class="aurora-status-card"><span>MICROFONE</span><b>${snapshot.microphone.active ? 'ATIVO' : permissionLabel(snapshot.microphone.permission).toUpperCase()}</b><small>Permissão controlada pelo usuário</small></article>
      </section>
      <section class="aurora-section">
        <div class="aurora-section-heading"><div><span class="aurora-eyebrow">AMBIENTE DO SISTEMA</span><h2>Aplicativos</h2></div><small>${APP_ITEMS.length} APLICATIVOS DISPONÍVEIS</small></div>
        <div class="aurora-app-grid">
          ${APP_ITEMS.map(item => `
            <button class="aurora-app-card" type="button" data-aurora-open-app="${item.id}">
              <span class="aurora-app-icon">${item.icon}</span>
              <b>${item.title}</b>
              <small>${item.detail}</small>
              <span class="aurora-app-open">ABRIR ↗</span>
            </button>`).join('')}
        </div>
      </section>
      <footer class="aurora-system-note"><b>ARQUITETURA ISOLADA</b><span>O AURORA OS não consulta nem altera diretamente o Ship Computer. Cada aplicativo acessa apenas os serviços que lhe forem autorizados.</span></footer>
    `;
    view.querySelectorAll('[data-aurora-open-app]').forEach(button => {
      button.addEventListener('click', () => openLegacyApp(button.dataset.auroraOpenApp));
    });
  }

  function renderAudio() {
    if (!view) return;
    const snapshot = manager.getSnapshot();
    const mic = snapshot.microphone;
    const micState = mic.active ? 'MICROFONE ATIVO' : 'MICROFONE INATIVO';
    const micHelp = mic.active
      ? 'A captura está ativa e o nível de entrada é monitorado localmente. A ligação à conversa por voz da Alexia será feita em uma etapa própria.'
      : mic.permission === 'denied'
        ? 'A permissão foi negada. No Android, abra Configurações > Aplicativos > Star Frontier > Permissões > Microfone e permita o acesso.'
        : mic.capabilityError
          ? 'Este ambiente não disponibiliza a captura de microfone: ' + mic.capabilityError
          : 'A permissão só será solicitada quando você tocar em ATIVAR MICROFONE.';
    view.innerHTML = `
      <header class="aurora-page-heading">
        <div><span class="aurora-eyebrow">AURORA OS // PREFERÊNCIAS DO SISTEMA</span><h1>Áudio e Microfone</h1><p>Controle centralizado de saída de áudio e entrada de microfone.</p></div>
        <button class="aurora-back-button" type="button" data-aurora-view="home">← INÍCIO</button>
      </header>
      <section class="aurora-audio-layout">
        <article class="aurora-control-card">
          <div class="aurora-card-heading"><div><span class="aurora-eyebrow">SAÍDA</span><h2>Áudio do sistema</h2></div><span class="aurora-chip">${snapshot.output.unlocked ? 'DESBLOQUEADO' : 'AGUARDANDO TOQUE'}</span></div>
          <p class="aurora-muted">O áudio é dividido em barramentos independentes. As configurações são salvas neste dispositivo.</p>
          <div class="aurora-slider-row"><label for="aurora-master-volume">Volume geral</label><output id="aurora-master-value">${Math.round(snapshot.output.masterVolume * 100)}%</output><input id="aurora-master-volume" type="range" min="0" max="1" step="0.01" value="${snapshot.output.masterVolume}"></div>
          ${BUS_ITEMS.map(bus => {
            const value = snapshot.output.busVolumes[bus.id] ?? 1;
            return `<div class="aurora-slider-row"><label for="aurora-bus-${bus.id}">${bus.label}</label><output id="aurora-value-${bus.id}">${Math.round(value * 100)}%</output><input id="aurora-bus-${bus.id}" type="range" min="0" max="1" step="0.01" value="${value}"></div>`;
          }).join('')}
          <div class="aurora-action-row">
            <button type="button" class="aurora-action-button" data-aurora-audio-action="unlock">ATIVAR ÁUDIO</button>
            <button type="button" class="aurora-action-button secondary" data-aurora-audio-action="mute">${snapshot.output.muted ? 'ATIVAR SOM' : 'SILENCIAR'}</button>
          </div>
        </article>
        <article class="aurora-control-card">
          <div class="aurora-card-heading"><div><span class="aurora-eyebrow">ENTRADA</span><h2>Microfone</h2></div><span id="aurora-mic-chip" class="aurora-chip ${mic.active ? 'is-active' : ''}">${micState}</span></div>
          <div class="aurora-mic-readout"><span>PERMISSÃO</span><b id="aurora-mic-permission">${permissionLabel(mic.permission)}</b></div>
          <div class="aurora-mic-meter"><i id="aurora-mic-level" style="width:${Math.min(100, Math.round(mic.inputLevel * 500))}%"></i></div>
          <p id="aurora-mic-help" class="aurora-muted">${escapeHtml(micHelp)}</p>
          <div class="aurora-action-row">
            <button type="button" class="aurora-action-button" data-aurora-audio-action="start-mic" ${mic.active || !mic.supported ? 'disabled' : ''}>ATIVAR MICROFONE</button>
            <button type="button" class="aurora-action-button secondary" data-aurora-audio-action="stop-mic" ${mic.active ? '' : 'disabled'}>DESATIVAR</button>
          </div>
          <button type="button" class="aurora-text-button" data-aurora-audio-action="refresh-permission">ATUALIZAR ESTADO DA PERMISSÃO</button>
        </article>
      </section>
      <p class="aurora-footnote">A captura não é iniciada automaticamente e não é reproduzida nos alto-falantes. A integração da entrada com o reconhecimento de voz da Alexia permanece separada para evitar duas capturas simultâneas.</p>
    `;
    bindAudioControls();
  }

  function bindAudioControls() {
    const master = view.querySelector('#aurora-master-volume');
    master?.addEventListener('input', () => {
      manager.setMasterVolume(Number(master.value));
      view.querySelector('#aurora-master-value').textContent = Math.round(Number(master.value) * 100) + '%';
    });
    for (const bus of BUS_ITEMS) {
      const input = view.querySelector('#aurora-bus-' + bus.id);
      input?.addEventListener('input', () => {
        manager.setBusVolume(bus.id, Number(input.value));
        view.querySelector('#aurora-value-' + bus.id).textContent = Math.round(Number(input.value) * 100) + '%';
      });
    }
    view.querySelectorAll('[data-aurora-audio-action]').forEach(button => {
      button.addEventListener('click', async () => {
        const action = button.dataset.auroraAudioAction;
        if (action === 'unlock') {
          const ok = await manager.unlockOutput();
          announce(ok ? 'Áudio do sistema ativado.' : 'Não foi possível ativar a saída de áudio.');
        } else if (action === 'mute') {
          manager.setMuted(!manager.getSnapshot().output.muted);
          renderAudio();
        } else if (action === 'start-mic') {
          button.disabled = true;
          const result = await manager.requestMicrophoneAccess({ audio: true });
          renderAudio();
          announce(result.ok ? 'Microfone ativado.' : microphoneErrorLabel(result.reason));
        } else if (action === 'stop-mic') {
          manager.stopMicrophone();
          renderAudio();
          announce('Microfone desativado.');
        } else if (action === 'refresh-permission') {
          await manager.refreshMicrophonePermission();
          renderAudio();
        }
      });
    });
  }

  function announce(message) {
    const toast = documentRef.getElementById('toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.remove('hidden');
      clearTimeout(announce.timer);
      announce.timer = setTimeout(() => toast.classList.add('hidden'), 2600);
    }
  }

  function handleClick(event) {
    const target = event.target.closest?.('[data-aurora-view]');
    if (target) {
      event.preventDefault();
      showHome();
      if (target.dataset.auroraView === 'audio') showAudio();
      return;
    }
  }

  function handleLegacyClick(event) {
    const target = event.target.closest?.('[data-panel]');
    if (!target) return;
    currentView = 'app:' + target.dataset.panel;
    menu.classList.remove('aurora-os-active');
    menu.classList.add('aurora-legacy-app');
    updateNavigationState();
  }

  function handleLogin() {
    showHome();
  }

  view?.addEventListener('click', handleClick);
  nav.addEventListener('click', handleClick);
  nav.addEventListener('click', handleLegacyClick);
  documentRef.getElementById('login-btn')?.addEventListener('click', handleLogin);

  const unsubscribe = manager.onChange(() => {
    if (currentView === 'home') renderHome();
    else if (currentView === 'audio') refreshAudioReadouts();
  });

  function refreshAudioReadouts() {
    const snapshot = manager.getSnapshot();
    const mic = snapshot.microphone;
    const chip = view.querySelector('#aurora-mic-chip');
    const permission = view.querySelector('#aurora-mic-permission');
    const level = view.querySelector('#aurora-mic-level');
    const help = view.querySelector('#aurora-mic-help');
    if (chip) {
      chip.textContent = mic.active ? 'MICROFONE ATIVO' : 'MICROFONE INATIVO';
      chip.classList.toggle('is-active', mic.active);
    }
    if (permission) permission.textContent = permissionLabel(mic.permission);
    if (level) level.style.width = Math.min(100, Math.round(mic.inputLevel * 500)) + '%';
    if (help) {
      help.textContent = mic.active
        ? 'A captura está ativa e o nível de entrada é monitorado localmente. A ligação à conversa por voz da Alexia será feita em uma etapa própria.'
        : mic.permission === 'denied'
          ? 'A permissão foi negada. No Android, abra Configurações > Aplicativos > Star Frontier > Permissões > Microfone e permita o acesso.'
          : mic.capabilityError
            ? 'Este ambiente não disponibiliza a captura de microfone: ' + mic.capabilityError
            : 'A permissão só será solicitada quando você tocar em ATIVAR MICROFONE.';
    }
    const start = view.querySelector('[data-aurora-audio-action="start-mic"]');
    const stop = view.querySelector('[data-aurora-audio-action="stop-mic"]');
    if (start) start.disabled = mic.active || !mic.supported;
    if (stop) stop.disabled = !mic.active;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    unsubscribe?.();
    view?.removeEventListener('click', handleClick);
    nav.removeEventListener('click', handleClick);
    nav.removeEventListener('click', handleLegacyClick);
    documentRef.getElementById('login-btn')?.removeEventListener('click', handleLogin);
  }

  showHome();
  void manager.initialize();
  return { showHome, showAudio, openLegacyApp, destroy };
}

function buildNavigation(documentRef, nav) {
  if (nav.dataset.auroraReady === 'true') return;
  nav.dataset.auroraReady = 'true';
  const appButtons = [...nav.querySelectorAll('[data-panel]')];
  const logout = nav.querySelector('#logout-btn');
  const system = documentRef.createElement('section');
  system.className = 'aurora-nav-section';
  system.innerHTML = `
    <span class="aurora-nav-heading">SISTEMA OPERACIONAL</span>
    <button type="button" data-aurora-view="home" class="active"><i>⌂</i> VISÃO GERAL</button>
    <button type="button" data-aurora-view="audio"><i>♫</i> ÁUDIO E MICROFONE</button>
  `;
  const apps = documentRef.createElement('section');
  apps.className = 'aurora-nav-section';
  apps.innerHTML = '<span class="aurora-nav-heading">APLICATIVOS</span>';
  appButtons.forEach(button => apps.append(button));
  nav.replaceChildren(system, apps);
  if (logout) nav.append(logout);
  const labels = { play: 'HANGAR', story: 'HISTÓRIA', character: 'PERSONAGEM', ships: 'NAVE', shop: 'LOJA', settings: 'CONFIGURAÇÕES' };
  appButtons.forEach(button => {
    button.textContent = labels[button.dataset.panel] || button.textContent;
    button.type = 'button';
  });
}

function buildView(documentRef, panel) {
  if (documentRef.getElementById(VIEW_ID)) return;
  const view = documentRef.createElement('section');
  view.id = VIEW_ID;
  view.className = 'aurora-os-view';
  view.setAttribute('aria-live', 'polite');
  panel.prepend(view);
}

function injectStyles(documentRef) {
  if (documentRef.getElementById(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #menu-screen { --aurora-cyan:#6ee7ff; --aurora-blue:#368bff; --aurora-line:rgba(99,195,255,.22); background:radial-gradient(ellipse at 76% 5%,rgba(27,119,180,.22),transparent 42%),radial-gradient(ellipse at 10% 100%,rgba(34,76,139,.17),transparent 48%),linear-gradient(145deg,#030916,#07172a 52%,#020711); }
    #menu-screen > * { max-width:1240px; }
    #menu-screen .topbar { min-height:68px; border-radius:15px; border-color:var(--aurora-line); background:linear-gradient(110deg,rgba(5,18,35,.96),rgba(8,31,54,.88)); box-shadow:0 14px 45px rgba(0,0,0,.25),inset 0 1px rgba(255,255,255,.035); }
    #menu-screen .topbar b { color:var(--aurora-cyan); letter-spacing:3px; }
    #menu-screen .topbar small { color:#8daec6; letter-spacing:1.5px; text-transform:uppercase; font-size:10px; }
    #menu-screen .menu-layout { grid-template-columns:minmax(190px,230px) minmax(0,1fr); gap:18px; align-items:start; }
    #menu-screen .menu-nav { padding:12px; border:1px solid var(--aurora-line); border-radius:16px; background:rgba(3,13,27,.84); box-shadow:0 18px 45px rgba(0,0,0,.24); }
    #menu-screen .aurora-nav-section { display:flex; flex-direction:column; gap:7px; }
    #menu-screen .aurora-nav-heading { padding:10px 8px 3px; color:#6e91ad; font-size:9px; font-weight:800; letter-spacing:1.8px; }
    #menu-screen .menu-nav button { min-height:43px; text-align:left; border-radius:9px; border-color:transparent; background:rgba(12,35,58,.72); color:#c8d9e8; font-size:11px; letter-spacing:.6px; }
    #menu-screen .menu-nav button i { display:inline-block; width:25px; color:var(--aurora-cyan); font-style:normal; font-size:17px; vertical-align:-1px; }
    #menu-screen .menu-nav button.active { border-color:rgba(110,231,255,.48); background:linear-gradient(100deg,rgba(22,102,145,.5),rgba(16,50,82,.7)); color:#fff; box-shadow:inset 3px 0 var(--aurora-cyan),0 0 22px rgba(43,174,225,.08); }
    #menu-screen .menu-nav #logout-btn { margin-top:8px; text-align:center; }
    #menu-screen .menu-panel { min-width:0; }
    #menu-screen.aurora-os-active #panel-content, #menu-screen.aurora-os-active .side-note { display:none !important; }
    #menu-screen.aurora-legacy-app #aurora-os-view { display:none; }
    #menu-screen.aurora-legacy-app #panel-content { display:block; }
    #menu-screen.aurora-legacy-app .side-note { display:block; }
    #menu-screen .aurora-os-view { min-height:440px; padding:clamp(17px,3vw,30px); border:1px solid var(--aurora-line); border-radius:18px; background:linear-gradient(145deg,rgba(7,22,40,.96),rgba(4,13,26,.95)); box-shadow:0 22px 55px rgba(0,0,0,.32),inset 0 1px rgba(255,255,255,.035); }
    #menu-screen .aurora-eyebrow { color:#6c9fbd; font-size:9px; font-weight:800; letter-spacing:2px; }
    #menu-screen .aurora-hero { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; padding-bottom:22px; border-bottom:1px solid rgba(104,180,222,.15); }
    #menu-screen .aurora-hero h1, #menu-screen .aurora-page-heading h1 { margin:8px 0; color:#e8f8ff; font-size:clamp(25px,4vw,38px); letter-spacing:2px; }
    #menu-screen .aurora-hero p, #menu-screen .aurora-page-heading p { max-width:560px; margin:0; color:#9bb4c8; font-size:13px; line-height:1.55; }
    #menu-screen .aurora-clock-card { min-width:190px; padding:14px; border:1px solid rgba(91,196,235,.2); border-radius:12px; background:rgba(11,38,61,.55); }
    #menu-screen .aurora-clock-card span, #menu-screen .aurora-clock-card small { display:block; color:#7195ae; font-size:9px; letter-spacing:1px; }
    #menu-screen .aurora-clock-card b { display:block; margin:8px 0; color:#dff8ff; font-size:15px; }
    #menu-screen .aurora-clock-card small { font-size:8px; line-height:1.4; }
    #menu-screen .aurora-status-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin:18px 0 25px; }
    #menu-screen .aurora-status-card { padding:13px; border:1px solid rgba(95,177,218,.17); border-radius:11px; background:rgba(10,31,51,.62); }
    #menu-screen .aurora-status-card span, #menu-screen .aurora-status-card small { display:block; color:#7699b2; font-size:9px; letter-spacing:1px; }
    #menu-screen .aurora-status-card b { display:block; margin:8px 0 5px; color:#d8f5ff; font-size:12px; }
    #menu-screen .aurora-status-card small { font-size:9px; letter-spacing:0; }
    #menu-screen .aurora-status-dot { display:inline-block; width:7px; height:7px; margin-right:5px; border-radius:50%; background:#58e6a5; box-shadow:0 0 10px #58e6a5; }
    #menu-screen .aurora-section-heading, #menu-screen .aurora-card-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    #menu-screen .aurora-section-heading h2, #menu-screen .aurora-card-heading h2 { margin:5px 0 12px; color:#e5f5ff; font-size:18px; }
    #menu-screen .aurora-section-heading > small { color:#7195ae; font-size:9px; letter-spacing:1px; }
    #menu-screen .aurora-app-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
    #menu-screen .aurora-app-card { display:flex; flex-direction:column; align-items:flex-start; min-height:132px; padding:14px; border:1px solid rgba(94,174,216,.19); border-radius:12px; background:linear-gradient(145deg,rgba(13,42,67,.78),rgba(7,22,40,.9)); text-align:left; }
    #menu-screen .aurora-app-card:active { transform:translateY(1px); border-color:var(--aurora-cyan); }
    #menu-screen .aurora-app-icon { display:grid; place-items:center; width:34px; height:34px; margin-bottom:10px; border:1px solid rgba(101,207,245,.24); border-radius:9px; background:rgba(27,110,151,.2); color:var(--aurora-cyan); font-size:19px; }
    #menu-screen .aurora-app-card b { color:#e5f5ff; font-size:12px; }
    #menu-screen .aurora-app-card small { margin-top:5px; color:#8ba9bf; font-size:10px; line-height:1.4; }
    #menu-screen .aurora-app-open { margin-top:auto; padding-top:12px; color:#70dfff; font-size:9px; font-weight:800; letter-spacing:1px; }
    #menu-screen .aurora-system-note { display:flex; gap:12px; margin-top:18px; padding:12px; border-left:2px solid #48c6eb; background:rgba(11,36,57,.42); color:#8ca9bd; font-size:10px; line-height:1.5; }
    #menu-screen .aurora-system-note b { flex:none; color:#76d8f4; font-size:9px; letter-spacing:1px; }
    #menu-screen .aurora-page-heading { display:flex; align-items:center; justify-content:space-between; gap:15px; margin-bottom:20px; }
    #menu-screen .aurora-page-heading h1 { font-size:clamp(22px,3vw,30px); }
    #menu-screen .aurora-back-button, #menu-screen .aurora-action-button { min-height:40px; padding:9px 13px; border:1px solid rgba(92,193,231,.35); border-radius:9px; background:rgba(13,54,79,.8); color:#aeeeff; font-size:10px; font-weight:800; letter-spacing:.7px; }
    #menu-screen .aurora-audio-layout { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:13px; }
    #menu-screen .aurora-control-card { min-width:0; padding:16px; border:1px solid rgba(93,177,216,.2); border-radius:13px; background:rgba(8,27,46,.74); }
    #menu-screen .aurora-card-heading h2 { margin-bottom:7px; }
    #menu-screen .aurora-chip { padding:6px 8px; border:1px solid rgba(120,158,185,.2); border-radius:20px; color:#9db4c7; font-size:8px; font-weight:800; letter-spacing:.7px; white-space:nowrap; }
    #menu-screen .aurora-chip.is-active { border-color:rgba(82,224,164,.4); color:#78e9b4; }
    #menu-screen .aurora-muted { color:#91aabd; font-size:11px; line-height:1.5; }
    #menu-screen .aurora-slider-row { display:grid; grid-template-columns:1fr auto; gap:5px 10px; align-items:center; margin:13px 0; }
    #menu-screen .aurora-slider-row label { color:#d4e8f5; font-size:11px; }
    #menu-screen .aurora-slider-row output { color:#76dfff; font-size:10px; font-variant-numeric:tabular-nums; }
    #menu-screen .aurora-slider-row input { grid-column:1/-1; min-height:20px; height:22px; padding:0; accent-color:#55d8f4; }
    #menu-screen .aurora-action-row { display:flex; flex-wrap:wrap; gap:8px; margin-top:16px; }
    #menu-screen .aurora-action-button.secondary { background:rgba(13,29,45,.85); color:#a9bfd0; }
    #menu-screen .aurora-action-button:disabled { opacity:.4; }
    #menu-screen .aurora-mic-readout { display:flex; justify-content:space-between; gap:10px; margin:17px 0 9px; color:#8da9bd; font-size:10px; }
    #menu-screen .aurora-mic-readout b { color:#d8f4ff; }
    #menu-screen .aurora-mic-meter { height:9px; overflow:hidden; border-radius:20px; background:rgba(2,10,20,.8); }
    #menu-screen .aurora-mic-meter i { display:block; width:0; height:100%; border-radius:20px; background:linear-gradient(90deg,#35a9df,#65e8b3); transition:width .12s linear; }
    #menu-screen .aurora-text-button { margin-top:13px; padding:7px 0; border:0; background:none; color:#73cde9; font-size:9px; letter-spacing:.6px; }
    #menu-screen .aurora-footnote { margin:16px 0 0; color:#7998ae; font-size:10px; line-height:1.5; }
    @media (max-width:760px) {
      #menu-screen { padding:12px; }
      #menu-screen .menu-layout { grid-template-columns:1fr; }
      #menu-screen .menu-nav { display:grid; grid-template-columns:1fr 1fr; align-items:start; }
      #menu-screen .aurora-nav-section { min-width:0; }
      #menu-screen .menu-nav #logout-btn { grid-column:1/-1; }
      #menu-screen .aurora-app-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
      #menu-screen .aurora-status-grid { grid-template-columns:1fr; }
      #menu-screen .aurora-audio-layout { grid-template-columns:1fr; }
      #menu-screen .aurora-hero { flex-direction:column; }
      #menu-screen .aurora-clock-card { width:100%; }
    }
  `;
  documentRef.head.append(style);
}

function permissionLabel(permission) {
  return ({ granted: 'AUTORIZADO', denied: 'NEGADO', prompt: 'AGUARDANDO AUTORIZAÇÃO', unsupported: 'NÃO SUPORTADO' })[permission] || 'NÃO VERIFICADO';
}

function microphoneErrorLabel(reason) {
  return ({
    'microphone-permission-denied': 'A permissão do microfone foi negada. Verifique as permissões do aplicativo Android.',
    'microphone-device-not-found': 'Nenhum microfone foi encontrado.',
    'microphone-device-busy': 'O microfone está sendo usado por outro aplicativo.',
    'microphone-api-unavailable': 'A captura de microfone não está disponível neste ambiente.',
    'microphone-insecure-context': 'A captura exige um contexto seguro.'
  })[reason] || 'Não foi possível ativar o microfone: ' + (reason || 'erro desconhecido');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

let auroraOSInstance = null;
if (globalThis.document) {
  auroraOSInstance = createAuroraOS();
}

export default auroraOSInstance;
