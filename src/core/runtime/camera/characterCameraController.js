export function createCharacterCameraController({ updateCamera, getMode }) {
  if (typeof updateCamera !== 'function' || typeof getMode !== 'function') {
    throw new TypeError('O controlador da câmera do personagem precisa de atualização e leitura de modo.');
  }

  return {
    id: 'character',
    update() {
      updateCamera();
      return getMode();
    }
  };
}
