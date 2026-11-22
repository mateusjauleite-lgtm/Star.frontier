import { RESOURCE_IDS } from '../core/resources/resourceCatalog.js';
export function createMiningRuntimeSystem({state,isActive,getAsteroids,getShip,getAsteroidSystem=()=>null,setAsteroids,save,updateWallet,shipAudio,toast,receiveDilithiumOre,addDilithiumOre}) {
 if(!state||typeof state!=='object')throw TypeError('O estado do jogo é obrigatório para mineração.');
 const receive=typeof receiveDilithiumOre==='function'?receiveDilithiumOre:addDilithiumOre;
 for(const [name,value] of Object.entries({isActive,getAsteroids,getShip,setAsteroids,save,updateWallet,toast,receiveDilithiumOre:receive}))if(typeof value!=='function')throw TypeError('Dependência de mineração inválida: '+name);
 if(typeof shipAudio?.playMining!=='function')throw TypeError('O áudio de mineração não está disponível.');
 function mine(){
  if(!isActive())return false;const asteroids=getAsteroids()||[],ship=getShip();if(!ship?.position)return false;
  const near=asteroids.map(asteroid=>({asteroid,distance:asteroid.position.distanceTo(ship.position)})).filter(x=>x.distance<18).sort((a,b)=>a.distance-b.distance);
  const target=near.find(({asteroid})=>Number(asteroid.userData.resources?.[RESOURCE_IDS.DILITHIUM_ORE]?.amount)>0)?.asteroid??near[0]?.asteroid;
  if(!target){toast('Aproxime-se de um asteroide para minerar.');return false;}
  const deposit=target.userData.resources?.[RESOURCE_IDS.DILITHIUM_ORE];
  if(Number(deposit?.amount)>0){
   const requested=Math.min(deposit.amount,state.miningDrill==='Broca reforçada'?12:6),stored=receive(requested),amount=Math.min(requested,Math.max(0,Number(stored?.added??stored?.received)||0));
   if(amount<=0){toast('Estoque de minério bruto da refinaria cheio.');return false;}
   deposit.amount-=amount;if(deposit.amount<=0)target.children.filter(c=>c.name==='Dilithium-Ore-Deposit').forEach(c=>{target.remove(c);c.traverse(o=>{if(!o.isMesh)return;o.geometry?.dispose?.();o.material?.dispose?.();});});
   if(target.userData.ore<=0&&deposit.amount<=0){getAsteroidSystem()?.remove(target);setAsteroids(getAsteroidSystem()?.asteroids||[]);}
   save();updateWallet();shipAudio.playMining();toast(`Mineração concluída: +${amount} unidades de minério bruto enviadas diretamente à Refinaria.`);return true;
  }
  if(state.cargo>=100){toast('Compartimento de carga cheio.');return false;}
  const amount=Math.min(target.userData.ore,state.miningDrill==='Broca reforçada'?12:6,100-state.cargo);target.userData.ore-=amount;state.ore+=amount;state.cargo+=amount;
  if(target.userData.ore<=0){getAsteroidSystem()?.remove(target);setAsteroids(getAsteroidSystem()?.asteroids||[]);}
  save();updateWallet();shipAudio.playMining();toast(`Extração concluída: +${amount} unidades de minério.`);return true;
 }
 return {priority:35,initialize(){},update(){},shutdown(){},mine};
}
