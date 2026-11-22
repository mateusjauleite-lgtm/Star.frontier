// Núcleo local do defletor: recebe energia elétrica do barramento da nave.
// Este sistema nunca lê, transfere ou consome dilítio diretamente.
const DEFAULT_CAPACITY = 100;
const DEFAULT_CHARGE_RATE = 2;
const EPSILON = 1e-9;

export function createDeflectorCoreSystem(state, options = {}) {
  if (!state || typeof state !== 'object') throw new TypeError('O estado da nave é obrigatório.');
  const capacity = positive(options.capacity, DEFAULT_CAPACITY);
  const chargeRate = positive(options.chargeRate, DEFAULT_CHARGE_RATE);
  const powerBus = options.powerBus || null;
  state.deflectorCoreEnergy = clamp(state.deflectorCoreEnergy, 0, capacity);
  state.deflectorCoreEnabled = state.deflectorCoreEnabled !== false;
  state.deflectorCoreChargingEnabled = state.deflectorCoreChargingEnabled !== false;
  state.deflectorCoreTransferredTotal = nonNegative(state.deflectorCoreTransferredTotal);
  state.deflectorCoreConsumedTotal = nonNegative(state.deflectorCoreConsumedTotal);
  if (!plainObject(state.deflectorBranchConsumptionTotals)) state.deflectorBranchConsumptionTotals = {};
  const branches = new Map();
  let transferAmount = 0, transferRate = 0, consumptionAmount = 0, consumptionRate = 0;

  function registerBranch(id, config = {}) {
    const key = String(id || '').trim();
    if (!key || branches.has(key)) throw new Error('Identificador de ramificação inválido ou duplicado: ' + key);
    const branch = { id:key, name:String(config.name || key),
      maxDrawPerSecond:positive(config.maxDrawPerSecond, Number.MAX_SAFE_INTEGER),
      enabled:config.enabled !== false, consumedTotal:nonNegative(state.deflectorBranchConsumptionTotals[key]),
      frameConsumption:0, lastConsumptionRate:0 };
    branches.set(key, branch);
    return branchSnapshot(branch);
  }
  function getBranch(id) {
    const branch = branches.get(String(id));
    if (!branch) throw new Error('Ramificação não registrada: ' + id);
    return branch;
  }
  function setBranchEnabled(id, enabled) {
    const b=getBranch(id); b.enabled=Boolean(enabled);
    if (!b.enabled) { b.frameConsumption=0; b.lastConsumptionRate=0; }
    return branchSnapshot(b);
  }
  function consumeEnergy(id, amount, dt) {
    const b=getBranch(id), requested=Math.max(0,finite(amount)), delta=Math.max(0,finite(dt));
    if (requested <= EPSILON) return Object.freeze({accepted:true,consumed:0,requested,remaining:energy()});
    if (!state.deflectorCoreEnabled || !b.enabled || delta<=0 || energy()<=EPSILON)
      return Object.freeze({accepted:false,consumed:0,requested,remaining:energy()});
    const allowance=Math.max(0,b.maxDrawPerSecond*delta-b.frameConsumption);
    const consumed=Math.min(energy(),requested,allowance);
    if(consumed>0){ b.frameConsumption+=consumed; b.consumedTotal+=consumed;
      b.lastConsumptionRate=b.frameConsumption/delta; state.deflectorCoreEnergy=energy()-consumed;
      state.deflectorCoreConsumedTotal+=consumed; state.deflectorBranchConsumptionTotals[b.id]=b.consumedTotal;
      consumptionAmount+=consumed; consumptionRate+=consumed/delta; }
    return Object.freeze({accepted:consumed>=requested-EPSILON,consumed,requested,remaining:energy()});
  }
  function update(dtValue) {
    const dt=Math.max(0,finite(dtValue)); transferAmount=0; transferRate=0; consumptionAmount=0; consumptionRate=0;
    for(const b of branches.values()){b.frameConsumption=0;b.lastConsumptionRate=0;}
    if(state.deflectorCoreEnabled && state.deflectorCoreChargingEnabled && dt>0 && powerBus){
      const request=Math.min(capacity-energy(),chargeRate*dt);
      // Contrato: draw(amount, dt) retorna energia elétrica efetivamente fornecida.
      const supplied=typeof powerBus.draw==='function' ? Math.max(0,Math.min(request,finite(powerBus.draw(request,dt)))) : 0;
      if(supplied>0){state.deflectorCoreEnergy=energy()+supplied;state.deflectorCoreTransferredTotal+=supplied;transferAmount=supplied;transferRate=supplied/dt;}
    }
    return snapshot();
  }
  function energy(){const n=clamp(state.deflectorCoreEnergy,0,capacity);state.deflectorCoreEnergy=n;return n;}
  function branchSnapshot(b){return Object.freeze({id:b.id,name:b.name,enabled:b.enabled,maxDrawPerSecond:b.maxDrawPerSecond,consumedTotal:b.consumedTotal,consumptionRate:b.lastConsumptionRate,available:Boolean(state.deflectorCoreEnabled&&b.enabled&&energy()>EPSILON)});}
  function snapshot(){return Object.freeze({enabled:Boolean(state.deflectorCoreEnabled),chargingEnabled:Boolean(state.deflectorCoreChargingEnabled),
    energy:energy(),capacity,fill:energy()/capacity,transferAmount,transferRate,
    transferredTotal:nonNegative(state.deflectorCoreTransferredTotal),consumptionAmount,consumptionRate,
    consumedTotal:nonNegative(state.deflectorCoreConsumedTotal),powerBusConnected:Boolean(powerBus),
    source:'ship-power-bus',branches:Array.from(branches.values(),branchSnapshot)});}
  function setEnabled(v){state.deflectorCoreEnabled=Boolean(v);return snapshot();}
  function setChargingEnabled(v){state.deflectorCoreChargingEnabled=Boolean(v);return snapshot();}
  return Object.freeze({registerBranch,setBranchEnabled,consumeEnergy,update,setEnabled,setChargingEnabled,snapshot});
}
function positive(v,f){const n=Number(v);return Number.isFinite(n)&&n>0?n:f;}
function finite(v){const n=Number(v);return Number.isFinite(n)?n:0;}
function nonNegative(v){return Math.max(0,finite(v));}
function clamp(v,min,max){return Math.max(min,Math.min(max,finite(v)));}
function plainObject(v){return Boolean(v&&typeof v==='object'&&!Array.isArray(v));}
