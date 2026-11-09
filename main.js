import * as THREE from 'three';
import { Filesystem, Directory } from '@capacitor/filesystem';

const $ = id => document.getElementById(id);

// Estrutura privada do jogo: criada no primeiro início e mantida entre atualizações.
async function prepareGameStorage(){
  const folders = [
    'StarFrontier',
    'StarFrontier/Assets',
    'StarFrontier/Assets/Naves',
    'StarFrontier/Assets/Planetas',
    'StarFrontier/Assets/Texturas',
    'StarFrontier/Assets/Sons',
    'StarFrontier/Assets/Mapas',
    'StarFrontier/Content',
    'StarFrontier/Saves'
  ];
  try {
    for (const path of folders) {
      await Filesystem.mkdir({ path, directory: Directory.Data, recursive: true });
    }
    console.info('Star Frontier: armazenamento interno preparado.');
  } catch (error) {
    console.warn('Não foi possível preparar o armazenamento interno:', error);
  }
}
prepareGameStorage();


const state = {
  user:'', email:'', country:'🇧🇷', credits:1000, ore:0, fuel:100,
  cargo:0, hull:100, shield:100, speed:0, ship:'Aurora-7',
  character:'Explorador', camera:2, throttle:false, braking:false,
  move:{x:0,y:0}, aim:{x:0,y:0}, miningDrill:'Broca básica',
  settings:{quality:'Média',music:40,effects:70,sensitivity:1}
};
const save = () => localStorage.setItem('sf-demo-state', JSON.stringify(state));
const load = () => { try { const x=JSON.parse(localStorage.getItem('sf-demo-state')); if(x) Object.assign(state,x); } catch{} };
load();

function show(id){ ['login-screen','menu-screen','game-screen'].forEach(x=>$(x).classList.add('hidden')); $(id).classList.remove('hidden'); }
function toast(msg){ $('toast').textContent=msg; $('toast').classList.remove('hidden'); setTimeout(()=>$('toast').classList.add('hidden'),2200); }
function updateWallet(){ $('credits').textContent=state.credits.toLocaleString('pt-BR'); $('ore-total').textContent=state.ore; $('ship-name').textContent=state.ship; $('profile-line').textContent=`${state.country} ${state.user} · Nv. 1`; }
function openNpc(name,msg){ $('npc-name').textContent=name; $('npc-text').textContent=msg; $('npc-bubble').classList.remove('hidden'); }
$('npc-close').onclick=()=> $('npc-bubble').classList.add('hidden');

$('login-btn').onclick=()=>{
  const name=$('login-name').value.trim(), pass=$('login-pass').value, email=$('login-email').value.trim();
  if(!name || !pass){ alert('Informe nome de usuário e senha para entrar ou cadastrar.'); return; }
  state.user=name.slice(0,18); state.email=email; state.country=$('country').value;
  save(); updateWallet(); show('menu-screen'); renderPanel('play');
};
$('forgot-btn').onclick=()=>alert('Neste protótipo local não existe servidor de e-mail. A recuperação real será adicionada quando houver backend de contas.');
$('logout-btn').onclick=()=>{save(); show('login-screen');};
if(state.user){ $('login-name').value=state.user; $('login-email').value=state.email||''; $('country').value=state.country||'🇧🇷'; updateWallet(); }

const panelText={
 play:['Hangar orbital','Sua jornada começa no Setor Orion. Decole, explore asteroides e converse com a tripulação.'],
 story:['Modo história','A campanha narrativa ainda está em construção. O protótipo atual permite exploração livre e mineração.'],
 character:['Personagens','Escolha uma aparência de piloto para esta demonstração. Personalização visual avançada será adicionada.'],
 ships:['Naves','Sua nave inicial fica vinculada ao piloto neste protótipo. Você pode trocar módulos e brocas.'],
 shop:['Loja do jogo','Compre equipamentos usando créditos de teste. Não há dinheiro real nem compras externas.'],
 settings:['Configurações de partida','Ajuste a qualidade, áudio e sensibilidade.']
};
function renderPanel(key){
  const [title,copy]=panelText[key]||panelText.play;
  $('panel-title').textContent=title; $('panel-copy').textContent=copy;
  const c=$('panel-content'); c.innerHTML='';
  const add=(html)=>c.insertAdjacentHTML('beforeend',html);
  if(key==='play') add(`<div class="panel-actions"><button class="primary" id="launch">🚀 Decolar</button><button id="brief">Falar com a oficial</button></div><div class="option-card"><b>Objetivo inicial</b><small>Explore o campo de asteroides, extraia minério e venda sua carga na estação.</small></div>`);
  if(key==='story') add(`<div class="option-card"><b>Prólogo: Sinais no vazio</b><small>Uma transmissão desconhecida foi detectada no Setor Orion. Missões de história serão implementadas depois.</small></div>`);
  if(key==='character') add(`<div class="option-card"><b>Personagem</b><div class="panel-actions"><button data-char="Explorador">Masculino</button><button data-char="Exploradora">Feminino</button></div><small>Escolha de apresentação provisória: ${state.character}.</small></div><div class="panel-actions"><button id="rename">Alterar nome do piloto</button></div>`);
  if(key==='ships') add(`<div class="option-card"><b>Aurora-7</b><small>Exploradora · equilíbrio entre velocidade e carga.</small></div><div class="option-card"><b>Brocas de mineração</b><small>Atual: ${state.miningDrill}. Broca reforçada: 350 CR.</small><button id="buy-drill">Comprar broca reforçada · 350 CR</button></div>`);
  if(key==='shop') add(`<div class="option-card"><b>Broca reforçada</b><small>Melhora a extração de minério.</small><button id="shop-drill">Comprar · 350 CR</button></div><div class="option-card"><b>Pacote de combustível</b><small>Reabastece 30 unidades.</small><button id="buy-fuel">Comprar · 120 CR</button></div>`);
  if(key==='settings') add(`<div class="field-row"><label>Qualidade gráfica</label><select id="quality"><option>Baixa</option><option selected>Média</option><option>Alta</option></select></div><div class="field-row"><label>Volume geral</label><input id="volume" type="range" min="0" max="100" value="60"><span>60%</span></div><div class="field-row"><label>Microfone</label><span>Não ativado nesta versão</span></div><div class="field-row"><label>Sensibilidade</label><input id="sens" type="range" min=".5" max="2" step=".1" value="1"></div><small>O protótipo não grava áudio. O volume é uma preferência visual até adicionarmos trilha sonora.</small>`);
  $('launch')?.addEventListener('click',startGame);
  $('brief')?.addEventListener('click',()=>alert('Oficial: “Piloto, o campo de asteroides está liberado. Boa exploração.”'));
  c.querySelectorAll('[data-char]').forEach(b=>b.onclick=()=>{state.character=b.dataset.char;save();renderPanel('character');});
  $('rename')?.addEventListener('click',()=>{const n=prompt('Novo nome (máximo 18 caracteres):',state.user);if(n?.trim()){state.user=n.trim().slice(0,18);save();updateWallet();renderPanel('character');}});
  const buyDrill=()=>{if(state.credits<350){toast('Créditos insuficientes.');return;}state.credits-=350;state.miningDrill='Broca reforçada';save();updateWallet();renderPanel(key);toast('Broca reforçada instalada.');};
  $('buy-drill')?.addEventListener('click',buyDrill); $('shop-drill')?.addEventListener('click',buyDrill);
  $('buy-fuel')?.addEventListener('click',()=>{if(state.credits<120){toast('Créditos insuficientes.');return;}state.credits-=120;state.fuel=Math.min(100,state.fuel+30);save();updateWallet();renderPanel(key);});
  $('quality')?.addEventListener('change',e=>{state.settings.quality=e.target.value;save();});
  $('sens')?.addEventListener('input',e=>{state.settings.sensitivity=+e.target.value;save();});
}
document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>renderPanel(b.dataset.panel));
renderPanel('play'); updateWallet();

let scene,camera,renderer,ship,stars,asteroids=[],npcs=[],last=performance.now(),active=false;
let cameraNames=['1ª PESSOA','CABINE','3ª PESSOA'];
function startGame(){
  show('game-screen');
  $('hud-user').textContent=`${state.country} ${state.user}`;
  if(!renderer) init3D();
  active=true; last=performance.now(); toast('Setor Orion: aproxime-se dos asteroides para minerar.');
}
function init3D(){
  scene=new THREE.Scene(); scene.background=new THREE.Color(0x020817); scene.fog=new THREE.FogExp2(0x020817,.0011);
  camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.1,2500);
  renderer=new THREE.WebGLRenderer({antialias:state.settings.quality!=='Baixa',powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,state.settings.quality==='Alta'?1.7:1.25));
  renderer.setSize(innerWidth,innerHeight); $('game-root').appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0x9acfff,0x101020,1.7));
  const sun=new THREE.PointLight(0x83bfff,110);sun.position.set(30,40,20);scene.add(sun);
  // Star field
  const pos=[];for(let i=0;i<1800;i++)pos.push((Math.random()-.5)*1200,(Math.random()-.5)*800,(Math.random()-.5)*1200);
  const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  stars=new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:1.5}));scene.add(stars);
  // Ship model: nose points toward -Z
  ship=new THREE.Group();scene.add(ship);
  const hullMat=new THREE.MeshStandardMaterial({color:0x9fb7ca,metalness:.75,roughness:.3});
  const core=new THREE.Mesh(new THREE.CapsuleGeometry(.65,2.1,5,10),hullMat);core.rotation.x=Math.PI/2;ship.add(core);
  const nose=new THREE.Mesh(new THREE.ConeGeometry(.65,1.8,8),new THREE.MeshStandardMaterial({color:0x477da7,metalness:.6}));nose.rotation.x=-Math.PI/2;nose.position.z=-2.0;ship.add(nose);
  for(const s of [-1,1]){
    const nac=new THREE.Mesh(new THREE.CylinderGeometry(.22,.3,2.3,12),new THREE.MeshStandardMaterial({color:0x607c98,metalness:.8}));nac.rotation.x=Math.PI/2;nac.position.set(s*1.35,.15,.35);ship.add(nac);
    const glow=new THREE.Mesh(new THREE.SphereGeometry(.24,12,12),new THREE.MeshBasicMaterial({color:0x39bfff}));glow.position.set(s*1.35,.15,1.55);ship.add(glow);
  }
  const shieldMesh=new THREE.Mesh(new THREE.SphereGeometry(3,24,16),new THREE.MeshBasicMaterial({color:0x168bff,wireframe:true,transparent:true,opacity:.09}));shieldMesh.scale.set(1,.7,1.25);ship.add(shieldMesh);
  // Asteroids
  for(let i=0;i<32;i++){
    const r=1.1+Math.random()*2.2;
    const a=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),new THREE.MeshStandardMaterial({color:[0x665d56,0x77716a,0x4e5962][i%3],roughness:1,flatShading:true}));
    a.position.set((Math.random()-.5)*180,(Math.random()-.5)*90,-25-Math.random()*260);a.rotation.set(Math.random()*3,Math.random()*3,0);a.userData={ore:Math.floor(4+Math.random()*12),radius:r};scene.add(a);asteroids.push(a);
  }
  // Nearby station / NPC marker
  const station=new THREE.Mesh(new THREE.TorusGeometry(9,.8,8,32),new THREE.MeshStandardMaterial({color:0x438bb5,metalness:.8}));station.position.set(24,3,-65);scene.add(station);
  const npc=new THREE.Mesh(new THREE.SphereGeometry(1.3,16,12),new THREE.MeshStandardMaterial({color:0xffc05b,emissive:0x553000}));npc.position.set(24,3,-65);scene.add(npc);npcs.push(npc);
  window.addEventListener('resize',resize3D);
  requestAnimationFrame(loop);
}
function resize3D(){if(!camera||!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}
function loop(now){
  requestAnimationFrame(loop);if(!active||!renderer)return;
  const dt=Math.min((now-last)/1000,.04);last=now;
  if(state.throttle && state.fuel>0){state.speed=Math.min(75,state.speed+18*dt);state.fuel=Math.max(0,state.fuel-.28*dt);}
  if(state.braking)state.speed=Math.max(0,state.speed-30*dt);
  state.speed=Math.max(0,state.speed-1.4*dt);
  const sens=state.settings.sensitivity||1;
  ship.rotation.y-=state.move.x*1.0*dt*sens;
  ship.rotation.x+=state.move.y*.8*dt*sens;
  ship.rotation.z+=state.aim.x*.8*dt*sens;
  ship.position.x-=Math.sin(ship.rotation.y)*state.speed*dt*.24;
  ship.position.y+=Math.sin(ship.rotation.x)*state.speed*dt*.14;
  ship.position.z-=state.speed*dt*.45;
  asteroids.forEach(a=>{a.rotation.x+=.001;a.rotation.y+=.0015;});
  stars.rotation.y+=.00012;
  if(state.camera===0){camera.position.copy(ship.position).add(new THREE.Vector3(0,.45,-.35).applyQuaternion(ship.quaternion));camera.quaternion.copy(ship.quaternion);}
  else if(state.camera===1){camera.position.copy(ship.position).add(new THREE.Vector3(0,.35,1.2).applyQuaternion(ship.quaternion));camera.quaternion.copy(ship.quaternion);}
  else {const offset=new THREE.Vector3(0,4,11).applyQuaternion(ship.quaternion);camera.position.lerp(ship.position.clone().add(offset),.09);camera.lookAt(ship.position);}
  renderer.render(scene,camera);
  $('speed').textContent=Math.round(state.speed);$('fuel').textContent=Math.round(state.fuel)+'%';$('cargo').textContent=state.cargo+' / 100';$('hull').textContent=state.hull+'%';$('shield').textContent=state.shield+'%';$('hud-credits').textContent=state.credits.toLocaleString('pt-BR');
}
function bindStick(id,key){
  const el=$(id),knob=el.querySelector('.knob');let pointer=null;
  const move=e=>{const r=el.getBoundingClientRect();let x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;const max=r.width*.31,len=Math.hypot(x,y);if(len>max){x*=max/len;y*=max/len;}state[key].x=x/max;state[key].y=y/max;knob.style.transform=`translate(${x}px,${y}px)`;};
  el.addEventListener('pointerdown',e=>{pointer=e.pointerId;el.setPointerCapture(pointer);move(e);});
  el.addEventListener('pointermove',e=>{if(pointer===e.pointerId)move(e);});
  const end=e=>{if(pointer===e.pointerId){pointer=null;state[key].x=0;state[key].y=0;knob.style.transform='translate(0,0)';}};
  el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
}
bindStick('move-stick','move');bindStick('aim-stick','aim');
function holdButton(id,key){const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();state[key]=true;b.setPointerCapture(e.pointerId);});['pointerup','pointercancel','lostpointercapture'].forEach(ev=>b.addEventListener(ev,()=>state[key]=false));}
holdButton('throttle-btn','throttle');holdButton('brake-btn','braking');
$('camera-btn').onclick=()=>{state.camera=(state.camera+1)%3;$('camera-btn').textContent='CÂMERA: '+cameraNames[state.camera];};
$('mine-btn').onclick=()=>{
  if(!active)return;
  const target=asteroids.find(a=>a.position.distanceTo(ship.position)<18);
  if(!target){toast('Aproxime-se de um asteroide para minerar.');return;}
  if(state.cargo>=100){toast('Compartimento de carga cheio.');return;}
  const amount=Math.min(target.userData.ore,state.miningDrill==='Broca reforçada'?12:6,100-state.cargo);
  target.userData.ore-=amount;state.ore+=amount;state.cargo+=amount;
  if(target.userData.ore<=0){scene.remove(target);asteroids=asteroids.filter(a=>a!==target);}
  save();updateWallet();toast(`Extração concluída: +${amount} unidades de minério.`);
};
$('fire-btn').onclick=()=>toast('Canhões de pulso: sistema de combate será adicionado na próxima versão.');
$('interact-btn').onclick=()=>openNpc('Comerciante da estação','Olá, piloto. Posso comprar todo o minério que estiver no seu compartimento por 8 créditos a unidade. Use o botão de interação novamente para vender.');
let npcReady=false;
$('interact-btn').addEventListener('click',()=>{
  if(!npcReady){npcReady=true;return;}
  if(state.cargo>0){const gain=state.cargo*8;state.credits+=gain;state.cargo=0;save();updateWallet();toast(`Carga vendida: +${gain} créditos.`);$('npc-text').textContent='Negócio fechado. Volte quando tiver mais minério.';}
});
$('game-menu').onclick=()=>$('game-menu-modal').classList.remove('hidden');
$('resume-btn').onclick=()=>$('game-menu-modal').classList.add('hidden');
$('return-menu-btn').onclick=()=>{active=false;$('game-menu-modal').classList.add('hidden');save();show('menu-screen');updateWallet();};
