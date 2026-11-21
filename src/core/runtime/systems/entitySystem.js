export function createEntityRuntimeSystem({ manager, onStage = () => {} } = {}) {
  if (!manager ||
      typeof manager.create !== 'function' ||
      typeof manager.get !== 'function' ||
      typeof manager.list !== 'function' ||
      typeof manager.exportSnapshot !== 'function') {
    throw new TypeError('O EntityManager não foi fornecido ao Runtime.');
  }

  return {
    priority: 5,
    initialize(context = {}) {
      onStage('preparação do registro de entidades');
      context.entityManager = manager;
    },
    shutdown(context = {}) {
      if (context.entityManager === manager) delete context.entityManager;
    }
  };
}
