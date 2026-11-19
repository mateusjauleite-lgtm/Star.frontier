export function createCharacterRuntimeSystem({
  core,
  resetTransientState,
  updateHUD,
  resetCounters = () => {},
  onStage = () => {}
}) {
  if (!core || typeof core.initialize !== 'function') {
    throw new TypeError('O núcleo do personagem não foi fornecido ao Runtime.');
  }

  return {
    priority: 10,
    initialize() {
      onStage('preparação do personagem');
      resetTransientState?.();
      core.initialize();
      core.setStamina?.(100);
      resetCounters();
      core.setMode?.('on-foot');
      updateHUD?.();
    }
  };
}
