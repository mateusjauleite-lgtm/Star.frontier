/**
 * Lifecycle registry for Earth modules.
 * Initialization is transactional: a failed module is disposed and already
 * attached modules are rolled back in reverse dependency order.
 */
export function createEarthUpdatePipeline(definitions = []) {
  const entries = new Map();

  for (const definition of definitions) {
    if (!definition?.id || entries.has(definition.id)) {
      throw new Error('Earth module definitions require unique ids.');
    }
    if (!Array.isArray(definition.dependsOn)) {
      throw new TypeError(`Earth module "${definition.id}" must declare dependsOn as an array.`);
    }
    entries.set(definition.id, { definition, runtime: null });
  }

  let disposed = false;

  const disposeRuntime = runtime => {
    try {
      runtime?.dispose?.();
    } catch (error) {
      console.warn('[Earth] Module disposal failed:', error);
    }
  };

  const disposeAttached = () => {
    const attached = [...entries.values()].reverse();
    for (const entry of attached) {
      if (!entry.runtime) continue;
      disposeRuntime(entry.runtime);
      entry.runtime = null;
    }
  };

  return {
    attach(id, runtime) {
      if (disposed) return false;
      const entry = entries.get(id);
      if (!entry || !runtime || typeof runtime !== 'object' || entry.runtime) return false;

      const dependenciesReady = entry.definition.dependsOn.every(dependency =>
        entries.get(dependency)?.runtime
      );
      if (!dependenciesReady) return false;

      // Register before initialize so rollback can always see the active runtime.
      entry.runtime = runtime;
      try {
        runtime.initialize?.();
      } catch (error) {
        disposeRuntime(runtime);
        entry.runtime = null;
        disposeAttached();
        disposed = true;
        throw new Error(`Unable to initialize Earth module "${id}".`, { cause: error });
      }
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
      disposeAttached();
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
