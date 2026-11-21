/**
 * Owns the frame-level gameplay sequence. Domain behavior stays in its
 * dedicated modules; this system defines their deterministic update order.
 */
const REQUIRED_PHASES = [
  'updateEnvironment',
  'updateCharacterMode',
  'updateLanding',
  'updateWorld',
  'render',
  'updateHud'
];

export function createGameplayRuntimeSystem(dependencies = {}) {
  const {
    isActive = () => true,
    isRendererReady = () => true
  } = dependencies;

  for (const name of REQUIRED_PHASES) {
    if (typeof dependencies[name] !== 'function') {
      throw new TypeError('A fase de gameplay "' + name + '" precisa ser uma função.');
    }
  }
  if (typeof isActive !== 'function' || typeof isRendererReady !== 'function') {
    throw new TypeError('Os verificadores de estado da gameplay precisam ser funções.');
  }

  return {
    priority: 40,
    update(deltaSeconds, context = {}) {
      if (!isActive(context) || !isRendererReady(context)) return false;

      dependencies.updateEnvironment(deltaSeconds, context);
      dependencies.updateCharacterMode(deltaSeconds, context);
      dependencies.updateLanding(deltaSeconds, context);
      dependencies.updateWorld(deltaSeconds, context);
      dependencies.render(deltaSeconds, context);
      dependencies.updateHud(deltaSeconds, context);
      return true;
    }
  };
}
