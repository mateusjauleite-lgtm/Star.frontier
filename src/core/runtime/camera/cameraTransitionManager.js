export function createCameraTransitionManager(cameraState) {
  if (!cameraState || typeof cameraState.getSnapshot !== 'function') {
    throw new TypeError('O gerenciador de transições precisa do estado central de câmera.');
  }

  return {
    begin(controller, mode) {
      return cameraState.activate(controller, mode);
    },
    complete() {
      return cameraState.completeTransition();
    },
    getSnapshot() {
      return cameraState.getSnapshot().transition;
    },
    reset() {
      cameraState.activate('none', null);
      cameraState.completeTransition();
    }
  };
}
