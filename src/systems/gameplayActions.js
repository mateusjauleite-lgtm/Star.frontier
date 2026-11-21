export function registerGameplayActions({
  document,
  THREE,
  getElement,
  state,
  isActive,
  getAsteroids,
  getShip,
  getAsteroidSystem,
  setAsteroids,
  save,
  updateWallet,
  shipAudio,
  characterAudio,
  toast,
  getNpcReady,
  setNpcReady
}) {
  getElement('mine-btn')?.addEventListener('click', () => {
    if (!isActive()) return;
    const asteroids = getAsteroids();
    const ship = getShip();
    const target = asteroids.find(asteroid => asteroid.position.distanceTo(ship.position) < 18);
    if (!target) {
      toast('Aproxime-se de um asteroide para minerar.');
      return;
    }
    if (state.cargo >= 100) {
      toast('Compartimento de carga cheio.');
      return;
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
  });

  getElement('fire-btn')?.addEventListener('click', () => {
    toast('Canhões de pulso: sistema de combate em desenvolvimento.');
  });

  getElement('interact-btn')?.addEventListener('click', () => {
    if (!isActive()) return;
    const ship = getShip();
    const nearStation = ship.position.distanceTo(new THREE.Vector3(24, 3, -65)) < 22;
    if (!nearStation) {
      toast('Aproxime-se da estação para interagir.');
      return;
    }
    characterAudio.playInteract();
    shipAudio.playConsole();
    const bubble = getElement('npc-bubble');
    if (!getNpcReady()) {
      setNpcReady(true);
      if (bubble) {
        bubble.innerHTML = `
          <b>Comerciante da estação</b>
          <p>Posso comprar seu minério por 8 créditos a unidade. Use INTERAGIR novamente para vender.</p>
          <button id="npc-close">FECHAR</button>
        `;
        bubble.classList.remove('hidden');
        getElement('npc-close')?.addEventListener('click', () => bubble.classList.add('hidden'));
      }
      return;
    }
    if (state.cargo > 0) {
      const gain = state.cargo * 8;
      state.credits += gain;
      state.cargo = 0;
      save();
      updateWallet();
      toast(`Carga vendida: +${gain} créditos.`);
      if (bubble) {
        bubble.innerHTML = `
          <b>Comerciante</b>
          <p>Negócio fechado. Volte quando tiver mais minério.</p>
          <button id="npc-close">FECHAR</button>
        `;
        getElement('npc-close')?.addEventListener('click', () => bubble.classList.add('hidden'));
      }
    } else {
      toast('Você não tem minério para vender.');
    }
    setNpcReady(false);
  });
}
