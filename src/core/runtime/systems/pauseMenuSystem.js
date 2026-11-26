export function createPauseMenuRuntimeSystem({
  runtime,
  document,
  state,
  resetInputs = () => {}
}) {
  if (!runtime || typeof runtime.pause !== 'function' || typeof runtime.resume !== 'function') {
    throw new TypeError('O controlador do menu de pausa precisa de uma ponte Runtime válida.');
  }
  if (!document || typeof document.getElementById !== 'function') {
    throw new TypeError('O controlador do menu de pausa precisa de um documento válido.');
  }

  let bindings = [];

  const bind = (id, handler) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.addEventListener('click', handler);
    bindings.push({ element, handler });
  };

  const open = () => {
    const modal = document.getElementById('game-menu-modal');
    if (!modal) return false;

    resetInputs();
    if (state) {
      state.throttle = false;
      state.braking = false;
      state.warpDriveButton = false;
    }

    modal.classList.remove('hidden');
    modal.setAttribute?.('aria-hidden', 'false');
    if (runtime.status === 'running') runtime.pause();
    return true;
  };

  const openSettings = () => {
    const actions = document.getElementById('pause-main-actions');
    const panel = document.getElementById('pause-settings-panel');
    if (!actions || !panel) return false;
    actions.classList.add('hidden');
    panel.classList.remove('hidden');
    panel.setAttribute?.('aria-hidden', 'false');
    return true;
  };

  const closeSettings = () => {
    const actions = document.getElementById('pause-main-actions');
    const panel = document.getElementById('pause-settings-panel');
    if (!actions || !panel) return false;
    panel.classList.add('hidden');
    panel.setAttribute?.('aria-hidden', 'true');
    actions.classList.remove('hidden');
    return true;
  };

  const resume = () => {
    closeSettings();
    const modal = document.getElementById('game-menu-modal');
    if (!modal) return false;

    modal.classList.add('hidden');
    modal.setAttribute?.('aria-hidden', 'true');
    if (runtime.status === 'paused') runtime.resume();
    return true;
  };

  return {
    initialize() {
      if (bindings.length) return;
      bind('character-menu-btn', open);
      bind('game-menu-btn', open);
      bind('resume-btn', resume);
      bind('pause-settings-btn', openSettings);
      bind('pause-settings-back-btn', closeSettings);
    },
    shutdown() {
      for (const { element, handler } of bindings) {
        element.removeEventListener('click', handler);
      }
      bindings = [];
      const modal = document.getElementById('game-menu-modal');
      closeSettings();
      modal?.classList.add('hidden');
      modal?.setAttribute?.('aria-hidden', 'true');
    },
    open,
    openSettings,
    closeSettings,
    resume
  };
}
