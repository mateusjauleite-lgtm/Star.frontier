export function createWorldRuntimeSystem({
  isReady,
  initializeWorld,
  registerEntities = () => {},
  onStage = () => {}
}) {
  if (typeof isReady !== 'function' || typeof initializeWorld !== 'function') {
    throw new TypeError('O sistema de mundo precisa de verificadores e inicializador.');
  }
  if (typeof registerEntities !== 'function') {
    throw new TypeError('O registro de entidades do mundo precisa ser uma função.');
  }

  let initializedWorld = null;

  return {
    priority: 20,
    async initialize(context = {}) {
      onStage('inicialização do mundo Three.js');
      if (!isReady()) initializedWorld = await initializeWorld(context);
      if (initializedWorld && typeof initializedWorld === 'object') context.world = initializedWorld;
      registerEntities(context);
    }
  };
}
