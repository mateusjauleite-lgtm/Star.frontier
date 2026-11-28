const MODES = new Set(['on-foot-ship', 'on-foot-planet', 'piloting', 'inactive']);

export function createGameplayControlModeController({
  document,
  characterHUD,
  characterControls,
  shipMovementControls,
  applyHudLayout = () => {},
  readHudLayout = () => ({})
}) {
  if (!document || !characterHUD || !characterControls || !shipMovementControls) {
    throw new TypeError('O controlador de modos precisa dos HUDs e dos dois controladores de entrada.');
  }

  let activeMode = null;
  const pilotElements = ['hud', 'warp-drive-display', 'flight-controls', 'leave-pilot-btn'];

  function setMode(mode) {
    if (!MODES.has(mode)) throw new TypeError('Modo de controle inválido: ' + mode);
    if (activeMode === mode) return false;

    const characterActive = mode === 'on-foot-ship' || mode === 'on-foot-planet';
    const pilotActive = mode === 'piloting';

    // Limpa qualquer toque/tecla mantido antes de liberar o outro conjunto.
    characterControls.reset();
    shipMovementControls.reset();
    characterControls.setEnabled(characterActive);
    shipMovementControls.setEnabled(pilotActive);

    characterHUD.show(characterActive);
    pilotElements.forEach(id => {
      document.getElementById(id)?.classList.toggle('hidden', !pilotActive);
    });

    activeMode = mode;
    if (mode !== 'inactive') {
      const profile = pilotActive ? 'pilot' : 'character';
      applyHudLayout(profile, readHudLayout(profile));
    }
    return true;
  }

  return Object.freeze({
    setMode,
    getMode: () => activeMode,
    isCharacterActive: () => activeMode === 'on-foot-ship' || activeMode === 'on-foot-planet',
    isPilotActive: () => activeMode === 'piloting'
  });
}
