export function createCameraInputController({ state, cameraState, THREE }) {
  if (!state || !cameraState || !THREE?.MathUtils) {
    throw new TypeError('A entrada de câmera precisa do estado de voo, do estado de câmera e do Three.js.');
  }

  return {
    setShipMode(mode) {
      if (!Number.isInteger(mode) || mode < 0 || mode > 2) return false;
      state.camera = mode;
      cameraState.setShipMode(mode);
      return true;
    },
    setCharacterMode(mode) {
      if (mode !== 'first-person' && mode !== 'third-person') return false;
      cameraState.setCharacterMode(mode);
      return true;
    },
    setView(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      state.view.x = THREE.MathUtils.clamp(x, -1.45, 1.45);
      state.view.y = THREE.MathUtils.euclideanModulo(y + Math.PI, Math.PI * 2) - Math.PI;
      return true;
    },
    setAim(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      state.aim.x = THREE.MathUtils.clamp(x, -1, 1);
      state.aim.y = THREE.MathUtils.clamp(y, -1, 1);
      return true;
    },
    resetAim() {
      state.aim.x = 0;
      state.aim.y = 0;
    }
  };
}
