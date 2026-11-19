export function createGameplayRuntimeSystem(update) {
  if (typeof update !== 'function') {
    throw new TypeError('A atualização da gameplay precisa ser uma função.');
  }
  return {
    priority: 40,
    update
  };
}
