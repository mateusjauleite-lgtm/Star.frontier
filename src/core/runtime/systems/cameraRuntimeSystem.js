import { createCameraState } from '../camera/cameraState.js';
import { createCameraTransitionManager } from '../camera/cameraTransitionManager.js';

export function createCameraRuntimeSystem({
  getCharacterMode,
  getShipMode,
  getCharacterCameraMode,
  shipController,
  characterController
} = {}) {
  if (typeof getCharacterMode !== 'function' ||
      typeof getShipMode !== 'function' ||
      typeof getCharacterCameraMode !== 'function' ||
      typeof shipController?.update !== 'function' ||
      typeof characterController?.update !== 'function') {
    throw new TypeError('O Camera Runtime precisa dos dois controladores e dos leitores de estado.');
  }

  const cameraState = createCameraState({
    shipMode: getShipMode(),
    characterMode: getCharacterCameraMode()
  });
  const transitions = createCameraTransitionManager(cameraState);
  let initialized = false;

  const service = {
    get state() {
      return cameraState.getSnapshot();
    },
    updateActive() {
      if (!initialized) return false;
      cameraState.setShipMode(getShipMode());
      cameraState.setCharacterMode(getCharacterCameraMode());
      const onFoot = getCharacterMode() === 'on-foot';
      const controller = onFoot ? characterController : shipController;
      const id = onFoot ? 'character' : 'ship';
      const mode = onFoot ? getCharacterCameraMode() : getShipMode();
      transitions.begin(id, mode);
      controller.update();
      cameraState.nextFrame();
      transitions.complete();
      return true;
    },
    reset() {
      cameraState.reset();
    },
    transitions
  };

  return {
    priority: 35,
    initialize(context = {}) {
      if (initialized) return false;
      initialized = true;
      context.cameraRuntime = service;
      return true;
    },
    update() {
      // A atualização visual é chamada pela fase de gameplay após o movimento
      // e imediatamente antes das fases de mundo/iluminação/renderização.
    },
    shutdown(context = {}) {
      if (context.cameraRuntime === service) delete context.cameraRuntime;
      service.reset();
      initialized = false;
    },
    service,
    cameraState
  };
}
