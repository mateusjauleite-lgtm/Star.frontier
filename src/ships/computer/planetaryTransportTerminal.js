const STYLE_ID = 'aurora-transporter-terminal-style';
const PANEL_ID = 'aurora-transporter-terminal';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function createPlanetaryTransportTerminal({ computer, earthTerrainReferenceCore = null, root = globalThis.document?.body, onDestinationConfirmed = () => {}, onOpenChange = () => {} } = {}) {
  const terminalId = 'planetary-transport-console';
  if (!computer || !root || typeof computer.connectTerminal !== 'function' || typeof computer.dispatch !== 'function') {
    throw new TypeError('O terminal AURORA exige o Ship Computer e uma raiz visual.');
  }
  const doc = root.ownerDocument || document;
  injectStyles(doc);
  let panel = doc.getElementById(PANEL_ID);
  if (!panel) {
    panel = doc.createElement('section');
    panel.id = PANEL_ID;
    panel.className = 'aurora-transporter hidden';
    panel.setAttribute('aria-label', 'AURORA OS — Transporte planetário');
    root.appendChild(panel);
  }
  let present = false, canInteract = false, connected = false, opened = false;
  let tab = 'destinations', query = '', selectedId = null, destinations = [], terrainReferences = [], status = null, destroyed = false;

  function dispatch(command, payload = {}) {
    if (!connected || !computer.isTerminalConnected(terminalId)) return { ok:false, reason:'terminal-disconnected' };
    return computer.dispatch(terminalId, 'planetary-transport', command, payload);
  }
  function refresh() {
    if (!connected) return null;
    const s = dispatch('status');
    const d = dispatch('search', { query });
    status = s.ok ? s.result : null;
    destinations = d.ok && Array.isArray(d.result) ? d.result : [];
    terrainReferences = earthTerrainReferenceCore?.listReferences?.() ?? [];
    if (selectedId && !destinations.some(item => item.id === selectedId)) selectedId = null;
    if (opened) render();
    return status;
  }
  function render() {
    if (!opened || destroyed) return;
    const power = status?.power || {};
    const energyCost = Number(status?.energyCost || 0);
    const ready = Boolean(power.available && Number(power.energy) >= energyCost);
    const selected = destinations.find(item => item.id === selectedId);
    const rows = destinations.map(item =>
      '<button type="button" class="aurora-tp-destination '+(item.id===selectedId?'is-selected':'')+'" data-tp-select="'+esc(item.id)+'">'+
      '<span><b>'+esc(item.name)+'</b><small>'+esc(item.bodyId)+' · '+Number(item.latitudeDeg).toFixed(5)+'°, '+Number(item.longitudeDeg).toFixed(5)+'°</small></span>'+
      '<i>'+(item.id===selectedId?'SELECIONADO':'SELECIONAR')+'</i></button>'
    ).join('');
    let content = '';
    if (tab === 'destinations') {
      content = '<section class="aurora-tp-card"><div class="aurora-tp-heading"><div><span>BASE GEOGRÁFICA</span><h3>Destinos registrados</h3></div><b>'+destinations.length+' REGISTROS</b></div>'+
        '<label class="aurora-tp-field"><span>PESQUISAR DESTINO</span><input data-tp-search type="search" value="'+esc(query)+'" placeholder="Nome, região ou referência"></label>'+
        '<div class="aurora-tp-list">'+(rows || '<p class="aurora-tp-note">Nenhum destino cadastrado. Registre uma coordenada terrestre abaixo.</p>')+'</div>'+
        '<form class="aurora-tp-form" data-tp-form><div class="aurora-tp-heading"><div><span>REFERÊNCIA TERRESTRE</span><h3>Registrar coordenadas</h3></div></div>'+
        '<div class="aurora-tp-grid">'+
        '<label class="aurora-tp-field"><span>NOME</span><input name="name" required maxlength="48" placeholder="Ex.: Base de pesquisa"></label>'+
        '<label class="aurora-tp-field"><span>LATITUDE (−90 A 90)</span><input name="latitude" type="number" step="any" min="-90" max="90" required placeholder="-22.29000"></label>'+
        '<label class="aurora-tp-field"><span>LONGITUDE (−180 A 180)</span><input name="longitude" type="number" step="any" min="-180" max="180" required placeholder="-48.56000"></label>'+
        '<label class="aurora-tp-field"><span>ELEVAÇÃO (METROS)</span><input name="elevation" type="number" step="any" value="0" required></label></div>'+
        '<button class="aurora-tp-button secondary" type="submit">VALIDAR E REGISTRAR COORDENADAS</button></form>'+
        '<div class="aurora-tp-selection"><div><span>DESTINO PREPARADO</span><b>'+(selected?esc(selected.name):'Nenhum destino selecionado')+'</b></div>'+
        '<button type="button" class="aurora-tp-button" data-tp-confirm '+(selected?'':'disabled')+'>CONFIRMAR DESTINO</button></div></section>';
    } else if (tab === 'terrain') {
      const references = terrainReferences.map(item =>
        '<article class="aurora-tp-terrain-row"><div><b>'+esc(item.name)+'</b><small>'+esc(item.sourceFormat.toUpperCase())+' · '+Number(item.latitudeDeg).toFixed(5)+'°, '+Number(item.longitudeDeg).toFixed(5)+'° · '+(item.collisionEnabled?'COLISÃO ATIVA':'VISUAL')+'</small></div>'+
        '<button type="button" data-tp-remove="'+esc(item.id)+'">REMOVER</button></article>'
      ).join('');
      content = '<section class="aurora-tp-card"><div class="aurora-tp-heading"><div><span>EARTH // TERRAIN REFERENCE CORE</span><h3>Importar região explorável</h3></div><b>'+(earthTerrainReferenceCore?'NÚCLEO CONECTADO':'NÚCLEO OFFLINE')+'</b></div>'+
        '<p class="aurora-tp-note">Importe uma malha de terreno georreferenciada. A região será consultada pelo sistema de colisão e registrada como destino de transporte. Não é necessária uma base ou plataforma no local.</p>'+
        '<form class="aurora-tp-form" data-tp-terrain-form>'+
        '<label class="aurora-tp-field"><span>ARQUIVO 3D · GLB / GLTF / OBJ / FBX</span><input data-tp-terrain-file name="file" type="file" accept=".glb,.gltf,.obj,.fbx" required '+(earthTerrainReferenceCore?'':'disabled')+'></label>'+
        '<div class="aurora-tp-grid">'+
        '<label class="aurora-tp-field"><span>NOME DA REGIÃO</span><input name="name" required maxlength="64" placeholder="Ex.: Vale de exploração"></label>'+
        '<label class="aurora-tp-field"><span>LATITUDE</span><input name="latitude" type="number" step="any" min="-90" max="90" required placeholder="-22.29000"></label>'+
        '<label class="aurora-tp-field"><span>LONGITUDE</span><input name="longitude" type="number" step="any" min="-180" max="180" required placeholder="-48.56000"></label>'+
        '<label class="aurora-tp-field"><span>ELEVAÇÃO DO PONTO DE ORIGEM (M)</span><input name="elevation" type="number" step="any" value="0" required></label>'+
        '<label class="aurora-tp-field"><span>METROS POR UNIDADE DO MODELO</span><input name="scale" type="number" step="any" min="0.000001" value="1" required></label>'+
        '<label class="aurora-tp-field"><span>RAIO DE BUSCA DE COLISÃO (M)</span><input name="searchDistance" type="number" step="any" min="1" value="10000" required></label></div>'+
        '<button class="aurora-tp-button" type="submit" '+(earthTerrainReferenceCore?'':'disabled')+'>VALIDAR E INTEGRAR TERRENO</button></form>'+
        '<div class="aurora-tp-heading"><div><span>REGIÕES IMPORTADAS</span><h3>Referências terrestres</h3></div><b>'+terrainReferences.length+' MALHAS</b></div>'+
        '<div class="aurora-tp-terrain-list">'+(references||'<p class="aurora-tp-note">Nenhuma região importada.</p>')+'</div></section>';
    } else if (tab === 'power') {
      content = '<section class="aurora-tp-card"><div class="aurora-tp-heading"><div><span>ENGENHARIA // DISTRIBUIÇÃO EPS</span><h3>Alimentação do teletransporte</h3></div><b class="'+(ready?'online':'offline')+'">'+(ready?'ENERGIZADO':'AGUARDANDO ENERGIA')+'</b></div>'+
        '<div class="aurora-tp-metrics"><article><span>BARRAMENTO</span><b>'+esc(power.bus||'OPERATIONS EPS')+'</b></article>'+
        '<article><span>ENERGIA DISPONÍVEL</span><b>'+Number(power.energy||0).toFixed(1)+' EPS</b></article>'+
        '<article><span>CUSTO POR TRANSPORTE</span><b>'+energyCost.toFixed(1)+' EPS</b></article>'+
        '<article><span>NÚCLEO DE DOBRA</span><b>'+(power.available?'ONLINE':'INDISPONÍVEL')+'</b></article></div>'+
        '<p class="aurora-tp-note">O equipamento recebe energia do barramento de operações alimentado pelo núcleo e monitorado pela Engenharia. O transporte é bloqueado se a reserva estiver insuficiente.</p></section>';
    } else {
      content = '<section class="aurora-tp-card"><div class="aurora-tp-heading"><div><span>SHIP COMPUTER // DIAGNÓSTICO</span><h3>Estado do sistema</h3></div><b class="'+(status?.state==='ready'?'online':'offline')+'">'+(status?.state==='ready'?'OPERACIONAL':'EM ESPERA')+'</b></div>'+
        '<div class="aurora-tp-metrics"><article><span>DESTINOS</span><b>'+Number(status?.destinationCount||0)+'</b></article>'+
        '<article><span>NÚCLEO</span><b>'+esc(status?.state||'OFFLINE')+'</b></article>'+
        '<article><span>ÚLTIMO TRANSPORTE</span><b>'+(status?.lastTransfer?esc(status.lastTransfer.destinationId):'NENHUM')+'</b></article>'+
        '<article><span>REFERENCIAL</span><b>TERRA / COORDENADAS</b></article></div>'+
        '<p class="aurora-tp-note">A interface pertence ao AURORA OS. Resolução geográfica, autorização, consumo de energia e movimentação são executados pelos sistemas centrais do Ship Computer.</p></section>';
    }
    panel.innerHTML = '<header class="aurora-tp-header"><div><span>AURORA OS // AURORA-7 // DECK 2</span><h2>TRANSPORTE PLANETÁRIO</h2><p>Terminal físico conectado ao Ship Computer</p></div>'+
      '<div class="aurora-tp-head-actions"><b>'+(status?.state==='ready'?'SISTEMA ONLINE':'SISTEMA EM ESPERA')+'</b><button type="button" data-tp-close aria-label="Fechar">×</button></div></header>'+
      '<nav class="aurora-tp-nav"><button type="button" data-tp-tab="destinations" class="'+(tab==='destinations'?'active':'')+'">DESTINOS</button>'+
      '<button type="button" data-tp-tab="terrain" class="'+(tab==='terrain'?'active':'')+'">TERRA / MALHAS</button>'+
      '<button type="button" data-tp-tab="power" class="'+(tab==='power'?'active':'')+'">ENGENHARIA / ENERGIA</button>'+
      '<button type="button" data-tp-tab="diagnostics" class="'+(tab==='diagnostics'?'active':'')+'">DIAGNÓSTICO</button></nav>'+
      '<main class="aurora-tp-main">'+content+'</main><footer class="aurora-tp-footer"><span>AURORA OS · TRANSPORTE</span><span>SHIP COMPUTER: CONECTADO</span></footer>';
    panel.querySelector('[data-tp-close]')?.addEventListener('click', close);
    panel.querySelectorAll('[data-tp-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tpTab;refresh();}));
    panel.querySelector('[data-tp-search]')?.addEventListener('change',e=>{query=e.currentTarget.value.trim();selectedId=null;refresh();});
    panel.querySelectorAll('[data-tp-select]').forEach(b=>b.addEventListener('click',()=>{selectedId=b.dataset.tpSelect;render();}));
    panel.querySelector('[data-tp-form]')?.addEventListener('submit',e=>{
      e.preventDefault();
      const f=new FormData(e.currentTarget);
      const latitudeDeg=Number(f.get('latitude')), longitudeDeg=Number(f.get('longitude'));
      const id=('coordinate-'+latitudeDeg.toFixed(5)+'-'+longitudeDeg.toFixed(5)).replace(/-/g,'m').replace(/\./g,'p');
      const result=dispatch('registerCoordinate',{id,name:String(f.get('name')||'').trim(),latitudeDeg,longitudeDeg,elevationMeters:Number(f.get('elevation'))});
      if(!result.ok||!result.result?.id){announce(result.result?.message||result.reason||'Coordenadas inválidas.');return;}
      query='';selectedId=result.result.id;refresh();announce('Coordenadas validadas e destino registrado.');
    });
    panel.querySelector('[data-tp-terrain-form]')?.addEventListener('submit',async e=>{
      e.preventDefault();
      if(!earthTerrainReferenceCore){announce('Earth Terrain Reference Core indisponível.');return;}
      const form=e.currentTarget, submit=form.querySelector('button[type="submit"]');
      const data=new FormData(form), file=data.get('file');
      if(!file?.name){announce('Selecione um arquivo 3D.');return;}
      const name=String(data.get('name')||'').trim();
      const latitudeDeg=Number(data.get('latitude')), longitudeDeg=Number(data.get('longitude'));
      const slug=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      const id='terrain-'+slug+'-'+Date.now();
      submit.disabled=true;submit.textContent='VALIDANDO MALHA...';
      try{
        const record=await earthTerrainReferenceCore.importFile(file,{
          id,name,latitudeDeg,longitudeDeg,elevationMeters:Number(data.get('elevation')),
          metersPerModelUnit:Number(data.get('scale')),
          collisionSearchDistanceMeters:Number(data.get('searchDistance')),
          surfaceRole:'terrain',destinationEnabled:true
        });
        selectedId=record.id;query='';refresh();
        announce('Terreno integrado. Destino '+record.name+' disponível no transporte planetário.');
      }catch(error){
        announce(error?.message||'Não foi possível integrar esta malha.');
      }finally{
        if(submit){submit.disabled=false;submit.textContent='VALIDAR E INTEGRAR TERRENO';}
      }
    });
    panel.querySelectorAll('[data-tp-remove]').forEach(button=>button.addEventListener('click',()=>{
      const id=button.dataset.tpRemove;
      if(earthTerrainReferenceCore?.removeReference?.(id)){refresh();announce('Referência removida e destino retirado do transporte.');}
    }));
    panel.querySelector('[data-tp-confirm]')?.addEventListener('click',()=>{
      const destination=destinations.find(item=>item.id===selectedId);
      if(!destination)return;
      onDestinationConfirmed(destination);
      suspend();
    });
  }
  function announce(message) {
    const toast=doc.getElementById('toast');
    if(toast){toast.textContent=String(message);toast.classList.remove('hidden');}
  }
  function open(operator='PILOTO') {
    if(destroyed||!present||!canInteract)return false;
    if(!computer.isTerminalConnected(terminalId)&&!computer.connectTerminal(terminalId,operator))return false;
    connected=true;opened=true;panel.classList.remove('hidden');panel.setAttribute('aria-hidden','false');refresh();onOpenChange(true);return true;
  }
  function suspend() {
    if(!opened)return false;
    opened=false;panel.classList.add('hidden');panel.setAttribute('aria-hidden','true');onOpenChange(false);return true;
  }
  function close() {
    suspend();
    if(connected||computer.isTerminalConnected(terminalId))computer.disconnectTerminal(terminalId);
    connected=false;return true;
  }
  function setPresence(visible,available=false) {
    present=Boolean(visible);canInteract=present&&Boolean(available);
    if(!present)close();
    return true;
  }
  function destroy(){if(destroyed)return;close();panel.remove();destroyed=true;}
  return Object.freeze({open,close,suspend,setPresence,dispatch,refresh,destroy,getSnapshot:()=>({present,interactionAvailable:canInteract,connected,open:opened,terminalId,selectedId})});
}

function injectStyles(doc) {
  if(doc.getElementById(STYLE_ID))return;
  const style=doc.createElement('style');style.id=STYLE_ID;
  style.textContent =
    '.aurora-transporter{position:fixed;inset:max(10px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));z-index:95;display:flex;flex-direction:column;gap:13px;box-sizing:border-box;padding:clamp(13px,2.2vw,25px);overflow:auto;color:#e8f6ff;background:radial-gradient(ellipse at 85% 0%,rgba(26,119,178,.2),transparent 42%),linear-gradient(145deg,#030b18,#081a2d 55%,#020812);border:1px solid rgba(104,202,238,.35);border-radius:15px;box-shadow:0 22px 70px rgba(0,0,0,.56);font-family:Arial,Helvetica,sans-serif}'+
    '.aurora-transporter.hidden{display:none!important}.aurora-transporter *{box-sizing:border-box}'+
    '.aurora-tp-header{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding-bottom:13px;border-bottom:1px solid rgba(111,196,232,.2)}'+
    '.aurora-tp-header span,.aurora-tp-heading span,.aurora-tp-field span,.aurora-tp-selection span,.aurora-tp-metrics span{color:#78a9c5;font-size:9px;font-weight:700;letter-spacing:1.1px;line-height:1.45}'+
    '.aurora-tp-header h2{margin:6px 0 4px;color:#e9f8ff;font-size:clamp(18px,3.4vw,27px);line-height:1.2;letter-spacing:1px;overflow-wrap:anywhere}.aurora-tp-header p{margin:0;color:#91aabd;font-size:11px;line-height:1.45}'+
    '.aurora-tp-head-actions{display:flex;align-items:center;gap:10px}.aurora-tp-head-actions b,.aurora-tp-heading>b{padding:7px 9px;border:1px solid rgba(145,176,197,.28);border-radius:5px;color:#9bb8ca;font-size:9px;letter-spacing:.5px;white-space:nowrap}.aurora-tp-head-actions button{width:38px;height:38px;border:1px solid rgba(131,190,218,.28);border-radius:50%;color:#dff6ff;background:#102b43;font-size:24px}'+
    '.aurora-tp-nav{display:flex;flex-wrap:wrap;gap:7px}.aurora-tp-nav button,.aurora-tp-button{min-height:39px;padding:9px 13px;border:1px solid rgba(105,184,222,.25);border-radius:7px;color:#b9d4e4;background:rgba(13,38,60,.82);font-size:10px;font-weight:700;letter-spacing:.45px;line-height:1.3}.aurora-tp-nav button.active{color:#effbff;border-color:rgba(96,217,255,.62);background:rgba(25,93,127,.48)}'+
    '.aurora-tp-main{width:min(100%,1000px);margin:0 auto;flex:1}.aurora-tp-card{display:flex;flex-direction:column;gap:13px;padding:clamp(12px,2vw,19px);border:1px solid rgba(102,177,213,.2);border-radius:11px;background:rgba(5,20,36,.78)}.aurora-tp-heading{display:flex;justify-content:space-between;align-items:center;gap:10px}.aurora-tp-heading h3{margin:4px 0 0;color:#e3f5ff;font-size:16px;line-height:1.3;letter-spacing:.2px}'+
    '.aurora-tp-field{display:flex;flex-direction:column;gap:6px;min-width:0}.aurora-tp-field input{width:100%;min-width:0;min-height:42px;padding:10px 11px;border:1px solid rgba(104,174,210,.28);border-radius:6px;outline:none;color:#e9f7ff;background:#07182a;font-size:13px;letter-spacing:0}.aurora-tp-field input:focus{border-color:#64d8f4;box-shadow:0 0 0 2px rgba(100,216,244,.12)}'+
    '.aurora-tp-list{display:flex;flex-direction:column;gap:6px;max-height:210px;overflow:auto}.aurora-tp-destination{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:52px;padding:9px 11px;text-align:left;border:1px solid rgba(96,169,207,.18);border-radius:7px;color:#e4f4ff;background:rgba(13,37,58,.72)}.aurora-tp-destination.is-selected{border-color:rgba(89,220,255,.65);background:rgba(17,83,111,.55)}.aurora-tp-destination span{display:flex;flex-direction:column;gap:4px;min-width:0}.aurora-tp-destination b{font-size:12px;line-height:1.3;overflow-wrap:anywhere}.aurora-tp-destination small,.aurora-tp-destination i{color:#8eafc4;font-size:9px;line-height:1.35;font-style:normal;letter-spacing:.2px}.aurora-tp-destination i{flex:0 0 auto}.aurora-tp-note{margin:0;color:#9ab4c6;font-size:11px;line-height:1.6}'+
    '.aurora-tp-form{display:flex;flex-direction:column;gap:10px;padding-top:12px;border-top:1px solid rgba(102,177,213,.16)}.aurora-tp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.aurora-tp-selection{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-top:12px;border-top:1px solid rgba(102,177,213,.16)}.aurora-tp-selection>div{display:flex;flex-direction:column;gap:5px;min-width:0}.aurora-tp-selection b{color:#e8f7ff;font-size:12px;line-height:1.4;overflow-wrap:anywhere}.aurora-tp-button{color:#061421;border-color:#75dff8;background:linear-gradient(110deg,#70d8f2,#68a9ff)}.aurora-tp-button.secondary{color:#c5e8f8;border-color:rgba(105,184,222,.36);background:rgba(15,48,73,.8)}.aurora-tp-button:disabled{opacity:.4}'+
    '.aurora-tp-terrain-list{display:flex;flex-direction:column;gap:7px}.aurora-tp-terrain-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px;border:1px solid rgba(104,174,210,.18);border-radius:7px;background:rgba(12,35,55,.65)}.aurora-tp-terrain-row>div{display:flex;flex-direction:column;gap:4px;min-width:0}.aurora-tp-terrain-row b{font-size:11px;overflow-wrap:anywhere}.aurora-tp-terrain-row small{color:#8eafc4;font-size:9px;line-height:1.4}.aurora-tp-terrain-row button{padding:7px 9px;border:1px solid rgba(255,157,157,.42);border-radius:5px;color:#ffc6c6;background:rgba(90,27,39,.3);font-size:9px;flex:0 0 auto}'+
    '.aurora-tp-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.aurora-tp-metrics article{display:flex;flex-direction:column;gap:7px;min-width:0;padding:12px;border:1px solid rgba(104,174,210,.18);border-radius:7px;background:rgba(12,35,55,.65)}.aurora-tp-metrics article b{color:#e5f6ff;font-size:12px;line-height:1.35;overflow-wrap:anywhere}.aurora-tp-footer{display:flex;justify-content:space-between;flex-wrap:wrap;gap:7px;padding-top:10px;border-top:1px solid rgba(111,196,232,.16);color:#6f94ab;font-size:8px;letter-spacing:.65px}'+
    '@media(max-width:560px){.aurora-transporter{border-radius:10px;gap:10px}.aurora-tp-header{flex-direction:column}.aurora-tp-head-actions{width:100%;justify-content:space-between}.aurora-tp-grid{grid-template-columns:1fr}.aurora-tp-selection{align-items:stretch;flex-direction:column}.aurora-tp-nav button{flex:1 1 100%}}';
  doc.head.appendChild(style);
}

export function createTransporterActionMenu({ root = globalThis.document?.body, onConfirm = () => {} } = {}) {
  if(!root)throw new TypeError('Menu de ação do teletransporte sem raiz visual.');
  const doc=root.ownerDocument||document;
  const menu=doc.createElement('section');menu.className='transporter-action-menu hidden';
  menu.setAttribute('aria-label','Ação de teletransporte');
  menu.innerHTML='<div class="transporter-action-orbit"><button type="button" class="transporter-action-primary">ACIONAR</button><div class="transporter-action-confirm hidden"><button type="button" data-tp-yes>CONF.</button><button type="button" data-tp-no>CANCELAR</button></div></div>';
  if(!doc.getElementById('transporter-action-menu-style')){
    const style=doc.createElement('style');style.id='transporter-action-menu-style';
    style.textContent='.transporter-action-menu{position:fixed;inset:0;z-index:110;display:grid;place-items:center;pointer-events:none;background:rgba(1,8,17,.22)}.transporter-action-menu.hidden{display:none}.transporter-action-orbit{position:relative;display:grid;place-items:center;width:116px;height:116px;border:1px solid rgba(91,210,255,.48);border-radius:50%;background:radial-gradient(circle,rgba(19,79,112,.94),rgba(3,15,30,.96) 72%);box-shadow:0 0 30px rgba(43,177,239,.22),inset 0 0 18px rgba(80,194,255,.16);pointer-events:auto}.transporter-action-menu button{display:grid;place-items:center;width:82px;height:82px;border:1px solid rgba(112,224,255,.7);border-radius:50%;color:#e9faff;background:linear-gradient(145deg,#145c83,#09243e);font-size:11px;font-weight:800;letter-spacing:.4px}.transporter-action-confirm{position:absolute;inset:-34px;display:flex;align-items:center;justify-content:space-between}.transporter-action-confirm.hidden{display:none}.transporter-action-confirm button{width:68px;height:68px;font-size:9px}.transporter-action-confirm [data-tp-yes]{border-color:rgba(105,238,185,.72)}.transporter-action-confirm [data-tp-no]{border-color:rgba(255,157,157,.62)}';
    doc.head.appendChild(style);
  }
  root.appendChild(menu);
  const primary=menu.querySelector('.transporter-action-primary'),confirm=menu.querySelector('.transporter-action-confirm');
  const close=()=>{menu.classList.add('hidden');confirm.classList.add('hidden');};
  primary.addEventListener('click',()=>{primary.classList.add('hidden');confirm.classList.remove('hidden');});
  menu.querySelector('[data-tp-no]').addEventListener('click',close);
  menu.querySelector('[data-tp-yes]').addEventListener('click',()=>{close();onConfirm();});
  return Object.freeze({open(){primary.classList.remove('hidden');confirm.classList.add('hidden');menu.classList.remove('hidden');},close,dispose(){close();menu.remove();},isOpen:()=>!menu.classList.contains('hidden')});
}
