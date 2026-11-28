const CONTEXT_TYPES = new Set(['ship', 'planet-surface', 'station', 'free-space']);

function isVectorInput(input) {
  return input && Number.isFinite(input.x) && Number.isFinite(input.y);
}

/** Routes character behavior to an environment adapter without owning the actor. */
export function createCharacterEnvironmentRouter({ onContextChanged = () => {} } = {}) {
  const adapters = new Map();
  let active = null;

  function register(contextId, adapter) {
    if (typeof contextId !== 'string' || !contextId.trim()) {
      throw new TypeError('O contexto do personagem precisa de um identificador.');
    }
    if (!adapter || !CONTEXT_TYPES.has(adapter.type)) {
      throw new TypeError('O adaptador precisa declarar um tipo de ambiente válido.');
    }
    for (const method of ['attach', 'detach', 'move', 'resolveGroundContact']) {
      if (typeof adapter[method] !== 'function') {
        throw new TypeError('O adaptador de ambiente precisa implementar ' + method + '().');
      }
    }
    if (adapters.has(contextId)) throw new Error('Já existe um adaptador registrado para ' + contextId + '.');
    adapters.set(contextId, adapter);
    let registered = true;
    return () => {
      if (!registered) return false;
      if (active?.id === contextId) throw new Error('Desative o contexto antes de remover seu adaptador.');
      registered = false;
      return adapters.delete(contextId);
    };
  }

  function activate(contextId, character, environment = {}) {
    const nextAdapter = adapters.get(contextId);
    if (!nextAdapter) throw new Error('Adaptador de personagem não registrado: ' + contextId);
    if (!character) throw new TypeError('O personagem é obrigatório para ativar um ambiente.');
    if (active?.id === contextId && active.character === character) return getActiveContext();

    const previous = active;
    if (previous) previous.adapter.detach(previous.character, previous.environment);
    active = null;
    try {
      nextAdapter.attach(character, environment);
      active = { id: contextId, type: nextAdapter.type, adapter: nextAdapter, character, environment };
    } catch (error) {
      if (previous) {
        try {
          previous.adapter.attach(previous.character, previous.environment);
          active = previous;
        } catch (restoreError) {
          error.restoreError = restoreError;
        }
      }
      throw error;
    }
    onContextChanged(getActiveContext(), previous ? { id: previous.id, type: previous.type } : null);
    return getActiveContext();
  }

  function deactivate() {
    if (!active) return false;
    const previous = active;
    previous.adapter.detach(previous.character, previous.environment);
    active = null;
    onContextChanged(null, { id: previous.id, type: previous.type });
    return true;
  }

  function getActiveContext() {
    return active ? Object.freeze({ id: active.id, type: active.type }) : null;
  }

  function move(input, deltaSeconds) {
    if (!active) return { accepted: false, reason: 'no-active-environment' };
    if (!isVectorInput(input)) throw new TypeError('A entrada de movimento precisa conter x e y válidos.');
    return active.adapter.move(active.character, input, deltaSeconds, active.environment);
  }

  function resolveGroundContact(position) {
    if (!active) return null;
    return active.adapter.resolveGroundContact(position, active.character, active.environment) ?? null;
  }

  function update(deltaSeconds) {
    if (!active || typeof active.adapter.update !== 'function') return null;
    return active.adapter.update(active.character, deltaSeconds, active.environment) ?? null;
  }

  return Object.freeze({ register, activate, deactivate, getActiveContext, move, resolveGroundContact, update });
}
