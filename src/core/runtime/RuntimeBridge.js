const validCallback = (value, label) => {
  if (value !== undefined && typeof value !== 'function') {
    throw new TypeError(label + ' deve ser uma função.');
  }
};

export function createRuntimeBridge(kernel) {
  if (!kernel || typeof kernel.tick !== 'function' ||
      typeof kernel.initialize !== 'function') {
    throw new TypeError('O núcleo C++ do Runtime não foi fornecido.');
  }

  const systems = [];
  let initializedSystems = [];
  let initialized = false;
  let disposed = false;
  let context = {};

  function ensureAvailable() {
    if (disposed) throw new Error('A ponte do Runtime já foi encerrada.');
  }

  function orderedSystems() {
    return [...systems].sort((a, b) => a.priority - b.priority || a.sequence - b.sequence);
  }

  async function shutdownInitializedSystems() {
    const current = [...initializedSystems].reverse();
    initializedSystems = [];
    for (const entry of current) {
      try {
        await entry.shutdown?.(context);
      } catch (error) {
        console.error('Falha ao encerrar o sistema ' + entry.name + ':', error);
      }
    }
    initialized = false;
  }

  return {
    get status() {
      return disposed ? 'disposed' : kernel.status;
    },
    get frameCount() {
      return kernel.frameCount;
    },
    get elapsedSeconds() {
      return kernel.elapsedSeconds;
    },
    registerSystem(name, system = {}) {
      ensureAvailable();
      if (initialized) throw new Error('Os sistemas devem ser registrados antes da inicialização.');
      if (typeof name !== 'string' || !name.trim()) {
        throw new TypeError('O sistema precisa de um nome válido.');
      }
      if (systems.some(entry => entry.name === name)) {
        throw new Error('Sistema já registrado: ' + name);
      }
      if (!system || typeof system !== 'object') {
        throw new TypeError('A definição do sistema deve ser um objeto.');
      }

      validCallback(system.initialize, 'initialize');
      validCallback(system.update, 'update');
      validCallback(system.shutdown, 'shutdown');

      systems.push({
        name,
        initialize: system.initialize,
        update: system.update,
        shutdown: system.shutdown,
        priority: Number.isFinite(system.priority) ? system.priority : 0,
        enabled: system.enabled !== false,
        sequence: systems.length
      });
      return this;
    },
    async initialize(nextContext = {}) {
      ensureAvailable();
      if (initialized) return false;
      if (!kernel.initialize()) return false;
      context = nextContext;
      initializedSystems = [];

      try {
        for (const entry of orderedSystems()) {
          if (!entry.enabled) continue;
          await entry.initialize?.(context);
          initializedSystems.push(entry);
        }
        initialized = true;
        return true;
      } catch (error) {
        await shutdownInitializedSystems();
        kernel.stop();
        throw error;
      }
    },
    start() {
      ensureAvailable();
      if (!initialized) return false;
      return kernel.start();
    },
    pause() {
      ensureAvailable();
      return kernel.pause();
    },
    resume() {
      ensureAvailable();
      return kernel.resume();
    },
    update(deltaSeconds) {
      ensureAvailable();
      if (kernel.status !== 'running') return 0;
      const safeDelta = kernel.tick(deltaSeconds);
      if (safeDelta <= 0) return 0;

      for (const entry of initializedSystems) {
        if (entry.enabled) entry.update?.(safeDelta, context);
      }
      return safeDelta;
    },
    async shutdown() {
      ensureAvailable();
      await shutdownInitializedSystems();
      kernel.stop();
      return true;
    },
    async dispose() {
      if (disposed) return;
      await shutdownInitializedSystems();
      kernel.stop();
      kernel.dispose?.();
      disposed = true;
    },
    listSystems() {
      return systems.map(({ name, priority, enabled }) => ({ name, priority, enabled }));
    }
  };
}
