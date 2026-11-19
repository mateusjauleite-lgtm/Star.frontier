export function createWorldRuntimeSystem({
  isReady,
  initializeWorld,
  onStage = () => {}
}) {
  if (typeof isReady !== 'function' || typeof initializeWorld !== 'function') {
    throw new TypeError('O sistema de mundo precisa de verificadores e inicializador.');
  }

  return {
    priority: 20,
    async initialize() {
      onStage('inicialização do mundo Three.js');
      if (!isReady()) await initializeWorld();
    }
  };
}
