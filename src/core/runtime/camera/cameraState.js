const VALID_CONTROLLERS = new Set(['ship', 'character', 'none']);

export function createCameraState({
  shipMode = 0,
  characterMode = 'third-person'
} = {}) {
  let activeController = 'none';
  let activeMode = null;
  let frame = 0;
  let transition = { status: 'idle', from: null, to: null, startedAtFrame: 0 };

  return {
    getSnapshot() {
      return {
        activeController,
        activeMode,
        shipMode,
        characterMode,
        frame,
        transition: { ...transition }
      };
    },
    setShipMode(mode) {
      shipMode = mode;
      return shipMode;
    },
    setCharacterMode(mode) {
      characterMode = mode;
      return characterMode;
    },
    activate(controller, mode = null) {
      if (!VALID_CONTROLLERS.has(controller)) {
        throw new TypeError('Controlador de câmera inválido: ' + controller);
      }
      const changed = controller !== activeController || mode !== activeMode;
      if (changed) {
        transition = {
          status: 'transitioning',
          from: activeController === 'none' ? null : activeController,
          to: controller,
          startedAtFrame: frame
        };
        activeController = controller;
        activeMode = mode;
      }
      return changed;
    },
    completeTransition() {
      if (transition.status !== 'transitioning') return false;
      transition = { ...transition, status: 'idle' };
      return true;
    },
    nextFrame() {
      frame += 1;
      return frame;
    },
    reset() {
      activeController = 'none';
      activeMode = null;
      frame = 0;
      transition = { status: 'idle', from: null, to: null, startedAtFrame: 0 };
    }
  };
}
