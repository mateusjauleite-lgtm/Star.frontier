export function createMiningRuntimeSystem({
  state, isActive, getAsteroids, getShip, getAsteroidSystem = () => null,
  setAsteroids, save, updateWallet, shipAudio, toast
}) {
  if (!state || typeof state !== 'object') throw new TypeError('O estado do jogo é obrigatório para mineração.');
  for (const [name, value] of Object.entries({ isActive, getAsteroids, getShip, setAsteroids, save, updateWallet, toast })) {
    if (typeof value !== 'function') throw new TypeError('Dependência de mineração inválida: ' + name);
  }
  if (typeof shipAudio?.playMining !== 'function') throw new TypeError('O áudio de mineração não está disponível.');

  function mine() {
    if (!isActive()) return false;
    const asteroids = getAsteroids() || [];
    const ship = getShip();
    if (!ship?.position) return false;
    const inRange = asteroids
      .map(asteroid => ({ asteroid, distance: asteroid.position.distanceTo(ship.position) }))
      .filter(entry => entry.distance < 18)
      .sort((a, b) => a.distance - b.distance);
    const target = inRange.find(({ asteroid }) =>
      Number(asteroid.userData.resources?.['resource:ore-dilithium']?.amount) > 0
    )?.asteroid ?? inRange[0]?.asteroid;
    if (!target) {
      toast('Aproxime-se de um asteroide para minerar.');
      return false;
    }
    if (state.cargo >= 100) {
      toast('Compartimento de carga cheio.');
      return false;
    }
    const dilithiumDeposit = target.userData.resources?.['resource:ore-dilithium'];
    if (Number(dilithiumDeposit?.amount) > 0) {
      const amount = Math.min(dilithiumDeposit.amount, state.miningDrill === 'Broca reforçada' ? 12 : 6);
      dilithiumDeposit.amount -= amount;
      state.rawDilithiumOre = Math.max(0, Number(state.rawDilithiumOre) || 0) + amount;
      if (dilithiumDeposit.amount <= 0) {
        target.children.filter(child => child.name === 'Dilithium-Ore-Deposit').forEach(child => {
          target.remove(child);
          child.traverse(object => {
            if (!object.isMesh) return;
            object.geometry?.dispose?.();
            object.material?.dispose?.();
          });
        });
      }
      if (target.userData.ore <= 0 && dilithiumDeposit.amount <= 0) {
        getAsteroidSystem()?.remove(target);
        setAsteroids(getAsteroidSystem()?.asteroids || []);
      }
      save();
      updateWallet();
      shipAudio.playMining();
      toast(`Mineração concluída: +${amount} unidades de minério bruto de dilítio.`);
      return true;
    }
    const amount = Math.min(target.userData.ore, state.miningDrill === 'Broca reforçada' ? 12 : 6, 100 - state.cargo);
    target.userData.ore -= amount;
    state.ore += amount;
    state.cargo += amount;
    if (target.userData.ore <= 0) {
      getAsteroidSystem()?.remove(target);
      setAsteroids(getAsteroidSystem()?.asteroids || []);
    }
    save();
    updateWallet();
    shipAudio.playMining();
    toast(`Extração concluída: +${amount} unidades de minério.`);
    return true;
  }
  return { priority: 35, initialize() {}, update() {}, shutdown() {}, mine };
}
