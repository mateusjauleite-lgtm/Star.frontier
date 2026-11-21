/**
 * Tracks whether the Runtime was paused by document visibility, so returning
 * to the app never overrides a pause explicitly requested by the player.
 */
export function createRuntimeVisibilityHandler({
  getRuntime,
  isActive,
  resetInputs = () => {}
} = {}) {
  if (typeof getRuntime !== 'function' || typeof isActive !== 'function' ||
      typeof resetInputs !== 'function') {
    throw new TypeError('Dependências do controle de visibilidade do Runtime inválidas.');
  }

  let pausedByVisibility = false;

  return hidden => {
    const runtime = getRuntime();
    if (hidden) {
      resetInputs();
      if (runtime?.status === 'running' && runtime.pause()) {
        pausedByVisibility = true;
      }
      return;
    }

    if (!pausedByVisibility) return;
    pausedByVisibility = false;
    if (isActive() && runtime?.status === 'paused') runtime.resume();
  };
}
