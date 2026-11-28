/** Keeps character identity separate from menu and scene lifetimes. */
export function createCharacterSession({
  captureState,
  restoreState,
  onStart = () => {},
  onEnd = () => {},
  onDestroy = () => {}
} = {}) {
  if (typeof captureState !== 'function' || typeof restoreState !== 'function') {
    throw new TypeError('A sessão precisa de funções para capturar e restaurar o personagem.');
  }

  let status = 'idle';
  let savedState = null;

  function start() {
    if (status === 'active') return false;
    if (status === 'suspended') return resume();
    onStart();
    status = 'active';
    return true;
  }

  function suspend() {
    if (status !== 'active') return false;
    savedState = captureState();
    status = 'suspended';
    onEnd({ suspended: true, state: savedState });
    return true;
  }

  function resume() {
    if (status !== 'suspended') return false;
    restoreState(savedState);
    status = 'active';
    savedState = null;
    onStart({ resumed: true });
    return true;
  }

  function end({ destroyCharacter = false } = {}) {
    if (status === 'idle') return false;
    if (status === 'active') savedState = captureState();
    onEnd({ suspended: false, state: savedState });
    status = 'idle';
    if (destroyCharacter) {
      onDestroy(savedState);
      savedState = null;
    }
    return true;
  }

  return Object.freeze({
    start, suspend, resume, end,
    getStatus: () => status,
    getSavedState: () => savedState
  });
}
