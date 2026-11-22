// Navegação assistida: interpreta telemetria e riscos fornecidos pelos sensores existentes.
export function createDeflectorNavigationSystem(core, options = {}) {
  const id='deflector-navigation', rate=positive(options.energyPerSecond,0.22);
  core.registerBranch(id,{name:'Navegação assistida',maxDrawPerSecond:rate,enabled:options.enabled!==false});
  let enabled=options.enabled!==false, telemetry={available:false}, routeRisk='unknown';
  function update(dt, input={}) {
    const nav=input.navigation||null, contacts=Array.isArray(input.contacts)?input.contacts:[];
    const requested=enabled&&nav?.available ? rate*Math.max(0,Number(dt)||0) : 0;
    const power=requested?core.consumeEnergy(id,requested,dt):{consumed:0,accepted:false};
    const nearest=contacts.reduce((best,c)=>!best||Number(c.distance)<Number(best.distance)?c:best,null);
    routeRisk=!nearest?'clear':Number(nearest.distance)<(options.warningDistance||250)?'warning':'clear';
    telemetry=Object.freeze({enabled,available:Boolean(nav?.available&&power.accepted),routeRisk,nearestContact:nearest,
      position:nav?.position||null,heading:nav?.heading??null,speed:nav?.speed??0,energyRate:power.consumed/(Math.max(0,Number(dt)||0)||1)});
    return telemetry;
  }
  function setEnabled(v){enabled=Boolean(v);core.setBranchEnabled(id,enabled);return telemetry;}
  return Object.freeze({update,setEnabled,snapshot:()=>telemetry});
}
function positive(v,f){const n=Number(v);return Number.isFinite(n)&&n>0?n:f;}
