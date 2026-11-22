// Gestão do campo protetor. A intensidade é solicitada pelo risco de navegação.
export function createDeflectorProtectionSystem(core, options = {}) {
  const id='deflector-protection',rate=positive(options.energyPerSecond,1.1);
  core.registerBranch(id,{name:'Proteção frontal',maxDrawPerSecond:rate,enabled:false});
  let enabled=false,status={enabled:false,active:false,strength:0,reason:'standby'};
  function update(dt, input={}) {
    const risk=input.routeRisk||'clear', requested=enabled&&risk==='warning'?rate*Math.max(0,Number(dt)||0):0;
    const power=requested?core.consumeEnergy(id,requested,dt):{consumed:0};
    const strength=requested?power.consumed/requested:0;
    status=Object.freeze({enabled,active:strength>0,strength,reason:risk==='warning'?'obstacle-detected':'standby'});
    return status;
  }
  function setEnabled(v){enabled=Boolean(v);core.setBranchEnabled(id,enabled);if(!enabled)status=Object.freeze({enabled:false,active:false,strength:0,reason:'standby'});return status;}
  return Object.freeze({update,setEnabled,snapshot:()=>status});
}
function positive(v,f){const n=Number(v);return Number.isFinite(n)&&n>0?n:f;}
