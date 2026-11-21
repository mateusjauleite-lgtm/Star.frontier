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

  const resume = () => {
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
    },
    shutdown() {
      for (const { element, handler } of bindings) {
        element.removeEventListener('click', handler);
      }
      bindings = [];
      const modal = document.getElementById('game-menu-modal');
      modal?.classList.add('hidden');
      modal?.setAttribute?.('aria-hidden', 'true');
    },
    open,
    resume
  };
}
