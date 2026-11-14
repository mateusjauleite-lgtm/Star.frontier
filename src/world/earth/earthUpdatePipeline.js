/**
 * Lifecycle registry for optional Earth update modules.
 * Definitions are inert until a reviewed runtime implementation is attached.
 */
export function createEarthUpdatePipeline(definitions = []) {
  const entries = new Map();

  for (const definition of definitions) {
    if (!definition?.id || entries.has(definition.id)) {
      throw new Error('Earth module definitions require unique ids.');
    }
    entries.set(definition.id, { definition, runtime: null });
  }

  let disposed = false;

  return {
    attach(id, runtime) {
      if (disposed) return false;
      const entry = entries.get(id);
      if (!entry || !runtime || typeof runtime !== 'object' || entry.runtime) return false;

      const dependenciesReady = entry.definition.dependsOn.every(dependency =>
        entries.get(dependency)?.runtime
      );
      if (!dependenciesReady) return false;

      entry.runtime = runtime;
      runtime.initialize?.();
      return true;
    },

    update(delta, context) {
      if (disposed) return;
      for (const { runtime } of entries.values()) {
        runtime?.update?.(delta, context);
      }
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const { runtime } of entries.values()) {
        runtime?.dispose?.();
      }
    },

    getStatus() {
      return [...entries.values()].map(({ definition, runtime }) => ({
        id: definition.id,
        label: definition.label,
        domain: definition.domain,
        status: runtime ? 'attached' : definition.status,
        enabledByDefault: definition.enabledByDefault,
        dependsOn: [...definition.dependsOn],
        implementation: definition.implementation
      }));
    }
  };
}
