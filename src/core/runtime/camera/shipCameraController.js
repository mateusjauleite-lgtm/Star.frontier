export function createShipCameraController({ updateCamera, getMode }) {
  if (typeof updateCamera !== 'function' || typeof getMode !== 'function') {
    throw new TypeError('O controlador da câmera da nave precisa de atualização e leitura de modo.');
  }

  return {
    id: 'ship',
    update() {
      updateCamera();
      return getMode();
    }
  };
}
