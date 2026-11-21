// Adaptadores entre o computador central e os sistemas reais da nave.
// Ponte e Engenharia enviam comandos para a mesma fonte de estado; não duplicam física.
const PROPULSION_INPUTS = new Set(['throttle', 'braking', 'warpDriveButton']);
const CONTROL_AUTHORITIES = new Set(['bridge', 'engineering', 'automatic']);
export function registerShipComputerSystems(computer, { state, getShip, getShipYaw, getPitchAngle, getAsteroids }) {
  if (!computer || !state || typeof getShip !== 'function' || typeof getShipYaw !== 'function' || typeof getPitchAngle !== 'function' || typeof getAsteroids !== 'function') throw new TypeError('Dependências dos sistemas do computador incompletas.');
  const readShip=()=>{const ship=getShip();return ship?.position?ship:null;};
  const readNavigation=()=>{const ship=readShip();if(!ship)return {available:false};const {x,y,z}=ship.position;return {available:true,position:{x,y,z},heading:getShipYaw(),pitch:getPitchAngle(),speed:state.speed};};
  const readPropulsion=()=>{
    if(!readShip())return {available:false};
    const warpDriveActive=Boolean(state.warpDriveButton&&state.warpDriveCharge>0&&state.fuel>0);
    return {available:true,authority:state.propulsionAuthority||'bridge',speed:state.speed,fuel:state.fuel,warpDriveCharge:state.warpDriveCharge,warpDriveActive,throttle:Boolean(state.throttle),braking:Boolean(state.braking),propulsionMode:warpDriveActive?'warp-drive-assist':state.throttle?'conventional':'idle'};
  };
  const applyPropulsionInput=({control,active}={})=>{
    if(!PROPULSION_INPUTS.has(control)||typeof active!=='boolean')return {accepted:false,reason:'invalid-propulsion-input'};
    if(!readShip())return {accepted:false,reason:'ship-unavailable'};
    state[control]=active;return {accepted:true,control,active,authority:state.propulsionAuthority};
  };
  const resetPropulsionInputs=()=>{for(const control of PROPULSION_INPUTS)state[control]=false;};
  computer.registerSystem('navigation',{name:'Navegação',commands:{telemetry:readNavigation},getStatus:()=>readShip()?'online':'standby'});
  computer.registerSystem('sensors',{name:'Sensores',commands:{scan:()=>{
    const ship=readShip();if(!ship||typeof ship.position.distanceTo!=='function')return {available:false,totalContacts:0,nearestContact:null,contacts:[]};
    const asteroids=getAsteroids();const contacts=(Array.isArray(asteroids)?asteroids:[]).filter(a=>a?.position).map((a,i)=>({id:a.name||`asteroid-${i+1}`,distance:ship.position.distanceTo(a.position),ore:a.userData?.ore??null})).sort((a,b)=>a.distance-b.distance);
    return {available:true,totalContacts:contacts.length,nearestContact:contacts[0]||null,contacts};
  }},getStatus:()=>readShip()?'online':'standby'});
  computer.registerSystem('power',{name:'Energia e recursos',commands:{status:()=>{
    const p=readPropulsion();if(!p.available)return {available:false};
    return {available:true,fuel:state.fuel,warpDriveCharge:state.warpDriveCharge,shields:state.shield,hull:state.hull,propulsionAuthority:p.authority,warpDriveActive:p.warpDriveActive,propulsionMode:p.propulsionMode};
  }},getStatus:()=>readShip()?'monitoring':'standby'});
  computer.registerSystem('propulsion',{name:'Propulsão',commands:{
    status:readPropulsion,
    setPilotInput:(payload,context)=>{
      if(context.terminalId!=='pilot-console')return {accepted:false,reason:'pilot-terminal-required'};
      const authority=state.propulsionAuthority||'bridge';if(authority==='engineering')return {accepted:false,reason:'engineering-has-authority'};
      if(authority==='automatic')state.propulsionAuthority='bridge';return applyPropulsionInput(payload);
    }
  },getStatus:()=>readShip()?'online':'standby'});
  computer.registerSystem('engineering',{name:'Engenharia e propulsão de dobra',commands:{
    status:()=>({...readPropulsion(),warpCore:'connected-to-ship-computer',warpField:'foundation'}),
    setAuthority:(payload,context)=>{
      if(context.terminalId!=='engineering-console')return {accepted:false,reason:'engineering-terminal-required'};
      const mode=payload?.mode;if(!CONTROL_AUTHORITIES.has(mode))return {accepted:false,reason:'invalid-authority'};
      resetPropulsionInputs();state.propulsionAuthority=mode;return {accepted:true,authority:mode};
    },
    setInput:(payload,context)=>{
      if(context.terminalId!=='engineering-console')return {accepted:false,reason:'engineering-terminal-required'};
      if(state.propulsionAuthority!=='engineering')return {accepted:false,reason:'engineering-authority-not-active'};
      return applyPropulsionInput(payload);
    }
  },getStatus:()=>readShip()?'online':'standby'});
  return true;
}
