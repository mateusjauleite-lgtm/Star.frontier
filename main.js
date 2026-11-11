
import * as THREE from 'three';

const $ = id => document.getElementById(id);

const state = {
  user:'', email:'', country:'🇧🇷',
  credits:1000, ore:0, fuel:100,
  cargo:0, hull:100, shield:100,
  speed:0, ship:'Aurora-7',
  character:'Explorador', camera:2,
  throttle:false, braking:false, nitroButton:false,
  nitro:100,
  move:{x:0,y:0},
  aim:{x:0,y:0},
  view:{x:0,y:0},
  miningDrill:'Broca básica',
  settings:{
    quality:'Média',
    music:40,
    effects:70,
    sensitivity:1
  }
};

const save = () => {
  localStorage.setItem('sf-demo-state',JSON.stringify(state));
};

const load = () => {
  try {
    const x=JSON.parse(localStorage.getItem('sf-demo-state'));
    if(x) {
      Object.assign(state,x);
      state.settings={
        quality:'Média',
        music:40,
        effects:70,
        sensitivity:1,
        ...(x.settings||{})
      };
      state.view={x:0,y:0};
      state.move={x:0,y:0};
      state.aim={x:0,y:0};
      state.throttle=false;
      state.braking=false;
      state.nitroButton=false;
      state.nitro=Number.isFinite(x.nitro)?x.nitro:100;
    }
  } catch {}
};

load();

/* MENU E PERFIL */

function show(id) {
  ['login-screen','menu-screen','game-screen'].forEach(x=>{
    $(x).classList.add('hidden');
  });
  $(id).classList.remove('hidden');
}

function toast(msg) {
  $('toast').textContent=msg;
  $('toast').classList.remove('hidden');
  setTimeout(()=>$('toast').classList.add('hidden'),2200);
}

function updateWallet() {
  $('credits').textContent=state.credits.toLocaleString('pt-BR');
  $('ore-total').textContent=state.ore;
  $('ship-name').textContent=state.ship;
  $('profile-line').textContent=`${state.country} ${state.user} · Nv. 1`;
}

function openNpc(name,msg) {
  $('npc-name').textContent=name;
  $('npc-text').textContent=msg;
  $('npc-bubble').classList.remove('hidden');
}

$('npc-close').onclick=()=>{
  $('npc-bubble').classList.add('hidden');
};

$('login-btn').onclick=()=>{
  const name=$('login-name').value.trim();
  const pass=$('login-pass').value;
  const email=$('login-email').value.trim();

  if(!name||!pass) {
    alert('Informe nome de usuário e senha para entrar ou cadastrar.');
    return;
  }

  state.user=name.slice(0,18);
  state.email=email;
  state.country=$('country').value;

  save();
  updateWallet();
  show('menu-screen');
  renderPanel('play');
};

$('forgot-btn').onclick=()=>{
  alert('Neste protótipo local não existe servidor de e-mail. A recuperação real será adicionada quando houver backend de contas.');
};

$('logout-btn').onclick=()=>{
  save();
  show('login-screen');
};

if(state.user) {
  $('login-name').value=state.user;
  $('login-email').value=state.email||'';
  $('country').value=state.country||'🇧🇷';
  updateWallet();
}

const panelText={
  play:[
    'Hangar orbital',
    'Sua jornada começa no Setor Orion. Decole, explore asteroides e converse com a tripulação.'
  ],
  story:[
    'Modo história',
    'A campanha narrativa ainda está em construção. O protótipo atual permite exploração livre e mineração.'
  ],
  character:[
    'Personagens',
    'Escolha uma aparência de piloto para esta demonstração.'
  ],
  ships:[
    'Naves',
    'Sua nave inicial fica vinculada ao piloto neste protótipo. Você pode trocar módulos e brocas.'
  ],
  shop:[
    'Loja do jogo',
    'Compre equipamentos usando créditos de teste. Não há dinheiro real nem compras externas.'
  ],
  settings:[
    'Configurações de partida',
    'Ajuste a qualidade, áudio e sensibilidade.'
  ]
};

function renderPanel(key) {
  const [title,copy]=panelText[key]||panelText.play;

  $('panel-title').textContent=title;
  $('panel-copy').textContent=copy;

  const c=$('panel-content');
  c.innerHTML='';

  const add=html=>c.insertAdjacentHTML('beforeend',html);

  if(key==='play') {
    add(`
      <div class="panel-actions">
        <button class="primary" id="launch">🚀 Decolar</button>
        <button id="brief">Falar com a oficial</button>
      </div>
      <div class="option-card">
        <b>Objetivo inicial</b>
        <small>Explore o campo de asteroides, extraia minério e venda sua carga na estação.</small>
      </div>
    `);
  }

  if(key==='story') {
    add(`
      <div class="option-card">
        <b>Prólogo: Sinais no vazio</b>
        <small>Uma transmissão desconhecida foi detectada no Setor Orion. Missões de história serão implementadas depois.</small>
      </div>
    `);
  }

  if(key==='character') {
    add(`
      <div class="option-card">
        <b>Personagem</b>
        <div class="panel-actions">
          <button data-char="Explorador">Masculino</button>
          <button data-char="Exploradora">Feminino</button>
        </div>
        <small>Escolha de apresentação provisória: ${state.character}.</small>
      </div>
      <div class="panel-actions">
        <button id="rename">Alterar nome do piloto</button>
      </div>
    `);
  }

  if(key==='ships') {
    add(`
      <div class="option-card">
        <b>Aurora-7</b>
        <small>Exploradora · equilíbrio entre velocidade e carga.</small>
      </div>
      <div class="option-card">
        <b>Brocas de mineração</b>
        <small>Atual: ${state.miningDrill}. Broca reforçada: 350 CR.</small>
        <button id="buy-drill">Comprar broca reforçada · 350 CR</button>
      </div>
    `);
  }

  if(key==='shop') {
    add(`
      <div class="option-card">
        <b>Broca reforçada</b>
        <small>Melhora a extração de minério.</small>
        <button id="shop-drill">Comprar · 350 CR</button>
      </div>
      <div class="option-card">
        <b>Pacote de combustível</b>
        <small>Reabastece 30 unidades.</small>
        <button id="buy-fuel">Comprar · 120 CR</button>
      </div>
    `);
  }

  if(key==='settings') {
    add(`
      <div class="field-row">
        <label>Qualidade gráfica</label>
        <select id="quality">
          <option>Baixa</option>
          <option selected>Média</option>
          <option>Alta</option>
        </select>
      </div>
      <div class="field-row">
        <label>Volume geral</label>
        <input id="volume" type="range" min="0" max="100" value="60">
        <span>60%</span>
      </div>
      <div class="field-row">
        <label>Microfone</label>
        <span>Não ativado nesta versão</span>
      </div>
      <div class="field-row">
        <label>Sensibilidade</label>
        <input id="sens" type="range" min=".5" max="2" step=".1" value="${state.settings.sensitivity}">
      </div>
      <small>O protótipo não grava áudio. O volume é uma preferência visual até adicionarmos trilha sonora.</small>
    `);
  }

  $('launch')?.addEventListener('click',startGame);

  $('brief')?.addEventListener('click',()=>{
    alert('Oficial: “Piloto, o campo de asteroides está liberado. Boa exploração.”');
  });

  c.querySelectorAll('[data-char]').forEach(b=>{
    b.onclick=()=>{
      state.character=b.dataset.char;
      save();
      renderPanel('character');
    };
  });

  $('rename')?.addEventListener('click',()=>{
    const n=prompt('Novo nome (máximo 18 caracteres):',state.user);
    if(n?.trim()) {
      state.user=n.trim().slice(0,18);
      save();
      updateWallet();
      renderPanel('character');
    }
  });

  const buyDrill=()=>{
    if(state.credits<350) {
      toast('Créditos insuficientes.');
      return;
    }

    state.credits-=350;
    state.miningDrill='Broca reforçada';
    save();
    updateWallet();
    renderPanel(key);
    toast('Broca reforçada instalada.');
  };

  $('buy-drill')?.addEventListener('click',buyDrill);
  $('shop-drill')?.addEventListener('click',buyDrill);

  $('buy-fuel')?.addEventListener('click',()=>{
    if(state.credits<120) {
      toast('Créditos insuficientes.');
      return;
    }

    state.credits-=120;
    state.fuel=Math.min(100,state.fuel+30);
    save();
    updateWallet();
    renderPanel(key);
  });

  $('quality')?.addEventListener('change',e=>{
    state.settings.quality=e.target.value;
    save();
  });

  $('sens')?.addEventListener('input',e=>{
    state.settings.sensitivity=+e.target.value;
    save();
  });
}

document.querySelectorAll('[data-panel]').forEach(b=>{
  b.onclick=()=>renderPanel(b.dataset.panel);
});

renderPanel('play');
updateWallet();

/* MOTOR 3D */

let scene,camera,renderer,ship,stars;
let asteroids=[],npcs=[];
let engineFlames=[],engineLights=[];
let last=performance.now();
let active=false;

const cameraNames=[
  '1ª PESSOA',
  'CABINE',
  '3ª PESSOA'
];

const cameraViewQuaternion=new THREE.Quaternion();
const viewEuler=new THREE.Euler(0,0,0,'YXZ');
const forwardVector=new THREE.Vector3();

function startGame() {
  show('game-screen');

  $('hud-user').textContent=`${state.country} ${state.user}`;

  if(!renderer) init3D();

  active=true;
  last=performance.now();

  toast('Setor Orion: aproxime-se dos asteroides para minerar.');
}

function addShipBox(parent,geometry,material,position,rotation={x:0,y:0,z:0}) {
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(position.x,position.y,position.z);
  mesh.rotation.set(rotation.x,rotation.y,rotation.z);
  parent.add(mesh);
  return mesh;
}

function init3D() {
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x020817);
  scene.fog=new THREE.FogExp2(0x020817,.0011);

  camera=new THREE.PerspectiveCamera(
    70,
    innerWidth/innerHeight,
    .1,
    2500
  );

  renderer=new THREE.WebGLRenderer({
    antialias:state.settings.quality!=='Baixa',
    powerPreference:'high-performance'
  });

  renderer.setPixelRatio(
    Math.min(
      devicePixelRatio,
      state.settings.quality==='Alta'?1.7:1.25
    )
  );

  renderer.setSize(innerWidth,innerHeight);
  $('game-root').appendChild(renderer.domElement);

  /* ILUMINAÇÃO */

  scene.add(
    new THREE.HemisphereLight(0x9acfff,0x101020,1.7)
  );

  const sun=new THREE.PointLight(0x83bfff,130,600);
  sun.position.set(30,40,20);
  scene.add(sun);

  const fillLight=new THREE.DirectionalLight(0x5caaff,1.4);
  fillLight.position.set(-20,12,-30);
  scene.add(fillLight);

  /* CAMPO DE ESTRELAS */

  const pos=[];

  for(let i=0;i<2200;i++) {
    pos.push(
      (Math.random()-.5)*1200,
      (Math.random()-.5)*800,
      (Math.random()-.5)*1200
    );
  }

  const sg=new THREE.BufferGeometry();
  sg.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(pos,3)
  );

  stars=new THREE.Points(
    sg,
    new THREE.PointsMaterial({
      color:0xffffff,
      size:1.5
    })
  );

  scene.add(stars);

  /* AURORA-7 */

  ship=new THREE.Group();
  scene.add(ship);

  const hullMat=new THREE.MeshStandardMaterial({
    color:0xaec5d8,
    metalness:.78,
    roughness:.27
  });

  const darkMat=new THREE.MeshStandardMaterial({
    color:0x263e55,
    metalness:.8,
    roughness:.3
  });

  const blueMat=new THREE.MeshStandardMaterial({
    color:0x357cae,
    metalness:.65,
    roughness:.25
  });

  const glassMat=new THREE.MeshStandardMaterial({
    color:0x43baff,
    metalness:.5,
    roughness:.12,
    emissive:0x07518b,
    emissiveIntensity:.65
  });

  const goldMat=new THREE.MeshStandardMaterial({
    color:0xc18b42,
    metalness:.75,
    roughness:.3
  });

  const engineMat=new THREE.MeshBasicMaterial({
    color:0x29cfff
  });

  /* CASCO CENTRAL */

  const core=new THREE.Mesh(
    new THREE.CapsuleGeometry(.9,3.5,6,12),
    hullMat
  );

  core.rotation.x=Math.PI/2;
  ship.add(core);

  /* PROA */

  const nose=new THREE.Mesh(
    new THREE.ConeGeometry(.9,2.5,10),
    blueMat
  );

  nose.rotation.x=-Math.PI/2;
  nose.position.z=-3.0;
  ship.add(nose);

  const noseWindow=addShipBox(
    ship,
    new THREE.BoxGeometry(.9,.16,.75),
    glassMat,
    {x:0,y:.65,z:-1.65}
  );

  /* CABINE SUPERIOR */

  const cockpit=new THREE.Mesh(
    new THREE.SphereGeometry(.72,20,12),
    glassMat
  );

  cockpit.scale.set(1.05,.48,1.3);
  cockpit.position.set(0,.78,-.85);
  ship.add(cockpit);

  /* ESTRUTURA SUPERIOR E INFERIOR */

  addShipBox(
    ship,
    new THREE.BoxGeometry(1.2,.2,2.1),
    darkMat,
    {x:0,y:1.02,z:.65}
  );

  addShipBox(
    ship,
    new THREE.BoxGeometry(1.1,.3,2.3),
    blueMat,
    {x:0,y:-.72,z:.7}
  );

  /* ASAS LATERAIS */

  for(const side of [-1,1]) {
    const wing=new THREE.Mesh(
      new THREE.BoxGeometry(2.5,.18,2.3),
      hullMat
    );

    wing.position.set(side*1.75,-.08,.05);
    wing.rotation.y=side*.12;
    ship.add(wing);

    const wingTip=new THREE.Mesh(
      new THREE.BoxGeometry(.38,.24,1.6),
      blueMat
    );

    wingTip.position.set(side*2.85,-.02,.15);
    ship.add(wingTip);

    /* PILARES DAS NACELLES */

    const pylon=new THREE.Mesh(
      new THREE.BoxGeometry(.3,.45,1.5),
      darkMat
    );

    pylon.position.set(side*1.45,.05,.55);
    ship.add(pylon);

    /* NACELLES */

    const nacelle=new THREE.Group();
    nacelle.position.set(side*2.45,.12,.75);
    ship.add(nacelle);

    const nacBody=new THREE.Mesh(
      new THREE.CylinderGeometry(.34,.43,3.4,16),
      darkMat
    );

    nacBody.rotation.x=Math.PI/2;
    nacelle.add(nacBody);

    const nacTop=new THREE.Mesh(
      new THREE.CylinderGeometry(.38,.38,.18,16),
      goldMat
    );

    nacTop.rotation.x=Math.PI/2;
    nacTop.position.z=-1.55;
    nacelle.add(nacTop);

    const engineRing=new THREE.Mesh(
      new THREE.TorusGeometry(.34,.09,8,20),
      blueMat
    );

    engineRing.position.z=1.72;
    nacelle.add(engineRing);

    const engineCore=new THREE.Mesh(
      new THREE.SphereGeometry(.27,16,12),
      engineMat
    );

    engineCore.position.z=1.77;
    engineCore.scale.z=.55;
    nacelle.add(engineCore);

    const flame=new THREE.Mesh(
      new THREE.ConeGeometry(.28,1.5,12),
      new THREE.MeshBasicMaterial({
        color:0x29cfff,
        transparent:true,
        opacity:.65
      })
    );

    flame.rotation.x=Math.PI/2;
    flame.position.z=2.45;
    nacelle.add(flame);

    engineFlames.push(flame);

    const engineLight=new THREE.PointLight(
      0x21bfff,
      2.5,
      15
    );

    engineLight.position.set(0,0,2.1);
    nacelle.add(engineLight);

    engineLights.push(engineLight);
  }

  /* DETALHES DE CASCO */

  for(const side of [-1,1]) {
    for(let i=0;i<3;i++) {
      const windowMesh=new THREE.Mesh(
        new THREE.BoxGeometry(.13,.09,.3),
        glassMat
      );

      windowMesh.position.set(
        side*.62,
        .63,
        -.3+i*.55
      );

      ship.add(windowMesh);
    }

    const sidePanel=new THREE.Mesh(
      new THREE.BoxGeometry(.13,.4,1.4),
      blueMat
    );

    sidePanel.position.set(side*.92,-.05,.8);
    ship.add(sidePanel);
  }

  /* COMPARTIMENTO DE CARGA / HANGAR */

  const cargoBay=new THREE.Mesh(
    new THREE.BoxGeometry(1.25,.55,1.45),
    darkMat
  );

  cargoBay.position.set(0,-.55,1.5);
  ship.add(cargoBay);

  const hangarDoor=new THREE.Mesh(
    new THREE.BoxGeometry(.9,.08,.9),
    goldMat
  );

  hangarDoor.position.set(0,-.86,1.5);
  ship.add(hangarDoor);

  /* LUZES DE POSIÇÃO */

  for(const side of [-1,1]) {
    const navLight=new THREE.Mesh(
      new THREE.SphereGeometry(.13,10,8),
      new THREE.MeshBasicMaterial({
        color:side===-1?0xff4545:0x35ff9a
      })
    );

    navLight.position.set(side*2.8,.2,-.6);
    ship.add(navLight);
  }

  /* ESCUDO */

  const shieldMesh=new THREE.Mesh(
    new THREE.SphereGeometry(4.5,32,20),
    new THREE.MeshBasicMaterial({
      color:0x168bff,
      wireframe:true,
      transparent:true,
      opacity:.055
    })
  );

  shieldMesh.scale.set(1.05,.62,1.45);
  ship.add(shieldMesh);

  /* ASTEROIDES */

  for(let i=0;i<32;i++) {
    const r=1.1+Math.random()*2.2;

    const a=new THREE.Mesh(
      new THREE.IcosahedronGeometry(r,1),
      new THREE.MeshStandardMaterial({
        color:[0x665d56,0x77716a,0x4e5962][i%3],
        roughness:1,
        flatShading:true
      })
    );

    a.position.set(
      (Math.random()-.5)*180,
      (Math.random()-.5)*90,
      -25-Math.random()*260
    );

    a.rotation.set(
      Math.random()*3,
      Math.random()*3,
      0
    );

    a.userData={
      ore:Math.floor(4+Math.random()*12),
      radius:r
    };

    scene.add(a);
    asteroids.push(a);
  }

  /* ESTAÇÃO */

  const station=new THREE.Group();

  const stationRing=new THREE.Mesh(
    new THREE.TorusGeometry(10,.8,12,48),
    new THREE.MeshStandardMaterial({
      color:0x438bb5,
      metalness:.8,
      roughness:.3
    })
  );

  station.add(stationRing);

  const stationCore=new THREE.Mesh(
    new THREE.CylinderGeometry(2.5,2.5,5,16),
    darkMat
  );

  stationCore.rotation.x=Math.PI/2;
  station.add(stationCore);

  station.position.set(24,3,-65);
  scene.add(station);

  const npc=new THREE.Mesh(
    new THREE.SphereGeometry(1.3,16,12),
    new THREE.MeshStandardMaterial({
      color:0xffc05b,
      emissive:0x553000
    })
  );

  npc.position.set(24,3,-65);
  scene.add(npc);
  npcs.push(npc);

  window.addEventListener('resize',resize3D);

  requestAnimationFrame(loop);
}

/* REDIMENSIONAMENTO */

function resize3D() {
  if(!camera||!renderer)return;

  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
}

/* MOVIMENTO E CÂMERA */

function updateFlight(dt) {
  const sens=state.settings.sensitivity||1;

  /* DIREÇÃO HORIZONTAL E VERTICAL */

  ship.rotation.y-=state.move.x*1.25*dt*sens;

  ship.rotation.x-=state.move.y*1.0*dt*sens;

  /* INCLINAÇÃO VISUAL */

  const targetRoll=-state.move.x*.25;

  ship.rotation.z=THREE.MathUtils.lerp(
    ship.rotation.z,
    targetRoll,
    Math.min(1,dt*3)
  );

  /* ACELERAÇÃO NORMAL */

  if(state.throttle&&state.fuel>0) {
    state.speed=Math.min(75,state.speed+18*dt);
    state.fuel=Math.max(0,state.fuel-.28*dt);
  }

  /* NITRO */

  const boosting=
    state.nitroButton&&
    state.nitro>0&&
    state.fuel>0;

  if(boosting) {
    state.speed=Math.min(115,state.speed+55*dt);
    state.nitro=Math.max(0,state.nitro-28*dt);
    state.fuel=Math.max(0,state.fuel-.55*dt);
  } else {
    state.nitro=Math.min(100,state.nitro+12*dt);
  }

  /* FREIO */

  if(state.braking) {
    state.speed=Math.max(0,state.speed-30*dt);
  }

  /* PERDA NATURAL DE VELOCIDADE */

  if(!state.throttle&&!boosting) {
    state.speed=Math.max(0,state.speed-1.4*dt);
  }

  /* DIREÇÃO REAL DA NAVE */

  forwardVector
    .set(0,0,-1)
    .applyQuaternion(ship.quaternion)
    .normalize();

  ship.position.addScaledVector(
    forwardVector,
    state.speed*dt*.45
  );

  /* CHAMAS E LUZES DAS NACELLES */

  const enginePower=boosting?2.5:(state.throttle?1.25:.65);

  engineFlames.forEach(flame=>{
    flame.scale.set(
      boosting?1.45:1,
      boosting?1.7:enginePower,
      boosting?1.45:1
    );

    flame.material.opacity=boosting?.95:
      (state.throttle?.7:.3);
  });

  engineLights.forEach(light=>{
    light.intensity=boosting?8:
      (state.throttle?4:1.5);
  });

  /* HUD DO NITRO */

  const nitroPercent=Math.round(state.nitro);

  $('nitro-level').textContent=nitroPercent+'%';
  $('nitro-fill').style.width=nitroPercent+'%';

  $('nitro-btn').classList.toggle('active',boosting);

  $('nitro-fill').style.background=
    nitroPercent<20
      ?'linear-gradient(90deg,#b52c2c,#ff7777)'
      :'linear-gradient(90deg,#0878d9,#37dfff)';
}

function updateCamera() {
  if(!camera||!ship)return;

  viewEuler.set(
    state.view.x,
    state.view.y,
    0,
    'YXZ'
  );

  cameraViewQuaternion.setFromEuler(viewEuler);

  const finalQuaternion=ship.quaternion.clone()
    .multiply(cameraViewQuaternion);

  if(state.camera===0) {
    const offset=new THREE.Vector3(
      0,.45,-.65
    ).applyQuaternion(ship.quaternion);

    camera.position.copy(ship.position).add(offset);
    camera.quaternion.copy(finalQuaternion);
  }

  else if(state.camera===1) {
    const offset=new THREE.Vector3(
      0,.45,.25
    ).applyQuaternion(ship.quaternion);

    camera.position.copy(ship.position).add(offset);
    camera.quaternion.copy(finalQuaternion);
  }

  else {
    const offset=new THREE.Vector3(
      0,4.5,13
    ).applyQuaternion(ship.quaternion);

    const desiredPosition=ship.position.clone().add(offset);

    camera.position.lerp(
      desiredPosition,
      Math.min(1,.09)
    );

    camera.quaternion.copy(finalQuaternion);
  }
}

/* LOOP PRINCIPAL */

function loop(now) {
  requestAnimationFrame(loop);

  if(!active||!renderer)return;

  const dt=Math.min((now-last)/1000,.04);
  last=now;

  updateFlight(dt);
  updateCamera();

  asteroids.forEach(a=>{
    a.rotation.x+=.001;
    a.rotation.y+=.0015;
  });

  stars.rotation.y+=.00012;

  renderer.render(scene,camera);

  $('speed').textContent=Math.round(state.speed);
  $('fuel').textContent=Math.round(state.fuel)+'%';
  $('cargo').textContent=state.cargo+' / 100';
  $('hull').textContent=state.hull+'%';
  $('shield').textContent=state.shield+'%';

  $('hud-credits').textContent=
    state.credits.toLocaleString('pt-BR');
}

/* JOYSTICK DE MOVIMENTO */

function bindStick(id,key) {
  const el=$(id);

  if(!el)return;

  const knob=el.querySelector('.knob');
  let pointer=null;

  const move=e=>{
    const r=el.getBoundingClientRect();

    let x=e.clientX-r.left-r.width/2;
    let y=e.clientY-r.top-r.height/2;

    const max=r.width*.31;
    const len=Math.hypot(x,y);

    if(len>max) {
      x*=max/len;
      y*=max/len;
    }

    state[key].x=x/max;
    state[key].y=y/max;

    knob.style.transform=`translate(${x}px,${y}px)`;
  };

  el.addEventListener('pointerdown',e=>{
    e.preventDefault();

    pointer=e.pointerId;
    el.setPointerCapture(pointer);

    move(e);
  });

  el.addEventListener('pointermove',e=>{
    if(pointer===e.pointerId) {
      e.preventDefault();
      move(e);
    }
  });

  const end=e=>{
    if(pointer===e.pointerId) {
      pointer=null;

      state[key].x=0;
      state[key].y=0;

      knob.style.transform='translate(0,0)';
    }
  };

  el.addEventListener('pointerup',end);
  el.addEventListener('pointercancel',end);
  el.addEventListener('lostpointercapture',end);
}

bindStick('move-stick','move');

/* CÂMERA CONTROLADA PELO DEDO */

const aimArea=$('aim-touch-area');

let aimPointer=null;
let previousTouchX=0;
let previousTouchY=0;

aimArea.addEventListener('pointerdown',e=>{
  e.preventDefault();

  aimPointer=e.pointerId;

  previousTouchX=e.clientX;
  previousTouchY=e.clientY;

  aimArea.setPointerCapture(aimPointer);
});

aimArea.addEventListener('pointermove',e=>{
  if(aimPointer!==e.pointerId)return;

  e.preventDefault();

  const dx=e.clientX-previousTouchX;
  const dy=e.clientY-previousTouchY;

  previousTouchX=e.clientX;
  previousTouchY=e.clientY;

  state.view.x-=dx*.004;
  state.view.y-=dy*.004;

  state.view.y=THREE.MathUtils.clamp(
    state.view.y,
    -1.15,
    1.15
  );
});

const endAim=e=>{
  if(aimPointer===e.pointerId) {
    aimPointer=null;
  }
};

aimArea.addEventListener('pointerup',endAim);
aimArea.addEventListener('pointercancel',endAim);
aimArea.addEventListener('lostpointercapture',endAim);

/* BOTÕES DE PRESSÃO */

function holdButton(id,key) {
  const b=$(id);

  if(!b)return;

  b.addEventListener('pointerdown',e=>{
    e.preventDefault();

    state[key]=true;

    try {
      b.setPointerCapture(e.pointerId);
    } catch {}
  });

  const stop=()=>{
    state[key]=false;
  };

  ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>{
    b.addEventListener(ev,stop);
  });
}

holdButton('throttle-btn','throttle');
holdButton('brake-btn','braking');
holdButton('nitro-btn','nitroButton');

/* PROTEÇÃO DOS CONTROLES CONTRA SELEÇÃO */

document.addEventListener('contextmenu',e=>{
  if(e.target.closest('#flight-controls')) {
    e.preventDefault();
  }
});

document.addEventListener('selectstart',e=>{
  if(e.target.closest('#flight-controls')) {
    e.preventDefault();
  }
});

/* CÂMERAS */

$('camera-btn').onclick=()=>{
  state.camera=(state.camera+1)%3;

  $('camera-btn').textContent=
    'CÂMERA: '+cameraNames[state.camera];
};

/* MINERAÇÃO */

$('mine-btn').onclick=()=>{
  if(!active)return;

  const target=asteroids.find(
    a=>a.position.distanceTo(ship.position)<18
  );

  if(!target) {
    toast('Aproxime-se de um asteroide para minerar.');
    return;
  }

  if(state.cargo>=100) {
    toast('Compartimento de carga cheio.');
    return;
  }

  const amount=Math.min(
    target.userData.ore,
    state.miningDrill==='Broca reforçada'?12:6,
    100-state.cargo
  );

  target.userData.ore-=amount;
  state.ore+=amount;
  state.cargo+=amount;

  if(target.userData.ore<=0) {
    scene.remove(target);
    asteroids=asteroids.filter(a=>a!==target);
  }

  save();
  updateWallet();

  toast(`Extração concluída: +${amount} unidades de minério.`);
};

/* DISPARO */

$('fire-btn').onclick=()=>{
  toast('Canhões de pulso: sistema de combate será adicionado na próxima versão.');
};

/* ESTAÇÃO E COMÉRCIO */

let npcReady=false;

$('interact-btn').onclick=()=>{
  openNpc(
    'Comerciante da estação',
    'Olá, piloto. Posso comprar todo o minério que estiver no seu compartimento por 8 créditos a unidade. Use o botão de interação novamente para vender.'
  );

  if(!npcReady) {
    npcReady=true;
    return;
  }

  if(state.cargo>0) {
    const gain=state.cargo*8;

    state.credits+=gain;
    state.cargo=0;

    save();
    updateWallet();

    toast(`Carga vendida: +${gain} créditos.`);

    $('npc-text').textContent=
      'Negócio fechado. Volte quando tiver mais minério.';
  }
};

/* MENU DE PAUSA */

$('game-menu').onclick=()=>{
  $('game-menu-modal').classList.remove('hidden');
};

$('resume-btn').onclick=()=>{
  $('game-menu-modal').classList.add('hidden');
};

$('return-menu-btn').onclick=()=>{
  active=false;

  state.throttle=false;
  state.braking=false;
  state.nitroButton=false;
  state.move={x:0,y:0};

  $('game-menu-modal').classList.add('hidden');

  save();
  show('menu-screen');
  updateWallet();
};
