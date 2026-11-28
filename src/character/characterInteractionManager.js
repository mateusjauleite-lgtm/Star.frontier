/**
 * Centralizes the final selection and activation of the character action button.
 * Gameplay systems publish candidates; only this manager resolves priority and UI state.
 */
export function createCharacterInteractionManager({ button = null, onTargetChange = () => {} } = {}) {
  if (typeof onTargetChange !== 'function') {
    throw new TypeError('onTargetChange precisa ser uma função.');
  }

  let active = null;
  let activeId = null;
  let activeTarget = null;

  function publishTarget(candidate) {
    const nextId = candidate?.id ?? null;
    const nextTarget = candidate?.target ?? null;
    if (nextId === activeId && nextTarget === activeTarget) return;
    activeId = nextId;
    activeTarget = nextTarget;
    onTargetChange(nextTarget, candidate ?? null);
  }

  function render(candidates = [], fallback = {}) {
    const selected = candidates
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate }) =>
        candidate &&
        candidate.visible !== false &&
        (candidate.available === true || candidate.disabled === true) &&
        typeof candidate.id === 'string' &&
        candidate.id.length > 0
      )
      .sort((a, b) =>
        (Number(b.candidate.priority) || 0) - (Number(a.candidate.priority) || 0) ||
        a.index - b.index
      )[0]?.candidate ?? null;

    active = selected;

    if (selected) {
      const disabled = selected.disabled === true || selected.available !== true;
      if (button) {
        button.classList?.toggle('hidden', false);
        button.disabled = disabled;
        if (button.textContent !== String(selected.label ?? 'AÇÃO')) {
          button.textContent = String(selected.label ?? 'AÇÃO');
        }
        if (button.dataset) button.dataset.interaction = selected.id;
        button.classList?.toggle('available', !disabled);
      }
      publishTarget(selected);
      return selected;
    }

    active = null;
    const hidden = fallback.hidden === true;
    const label = String(fallback.label ?? 'AÇÃO');
    if (button) {
      button.classList?.toggle('hidden', hidden);
      button.disabled = true;
      if (button.textContent !== label) button.textContent = label;
      if (button.dataset) button.dataset.interaction = '';
      button.classList?.remove('available');
    }
    publishTarget(fallback.target ? { id: null, target: fallback.target } : null);
    return null;
  }

  function activate() {
    if (!active || active.disabled === true || active.available !== true ||
        typeof active.activate !== 'function') return false;
    active.activate();
    return true;
  }

  return {
    render,
    activate,
    getActiveInteraction: () => active ? { ...active } : null
  };
}
