// Emissão científica sob comando; permanece desligada por padrão.
export function createDeflectorScienceSystem(core, options = {}) {
  const id='deflector-science',rate=positive(options.energyPerSecond,0.8);
  core.registerBranch(id,{name:'Emissão científica',maxDrawPerSecond:rate,enabled:false});
  let enabled=false,mode='passive',pulseTotal=0;
  function update(dt){const requested=enabled?rate*Math.max(0,Number(dt)||0):0;
    const power=requested?core.consumeEnergy(id,requested,dt):{consumed:0};
    if(power.consumed>0)pulseTotal+=power.consumed;
    return snapshot();}
  function setMode(value){mode=['passive','scan-pulse','spectral'].includes(value)?value:'passive';return snapshot();}
  function setEnabled(v){enabled=Boolean(v);core.setBranchEnabled(id,enabled);return snapshot();}
  function snapshot(){return Object.freeze({enabled,mode,pulseTotal,active:enabled});}
  return Object.freeze({update,setMode,setEnabled,snapshot});
}
function positive(v,f){const n=Number(v);return Number.isFinite(n)&&n>0?n:f;}
