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
  let frameLoopEnabled = false;
  let frameRequestId = null;
  let frameLoopConfig = null;
  let frameLoopLastTimestamp = 0;
  let frameCallback = null;

  function cancelScheduledFrame() {
    if (frameRequestId !== null && typeof frameLoopConfig?.cancelFrame === 'function') {
      frameLoopConfig.cancelFrame.call(globalThis, frameRequestId);
    }
    frameRequestId = null;
  }

  function stopFrameLoop() {
    frameLoopEnabled = false;
    cancelScheduledFrame();
    frameCallback = null;
    frameLoopConfig = null;
  }

  function scheduleNextFrame() {
    if (!frameLoopEnabled || kernel.status !== 'running' ||
        frameRequestId !== null || typeof frameLoopConfig?.requestFrame !== 'function') return;
    frameRequestId = frameLoopConfig.requestFrame.call(globalThis, frameCallback);
  }

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
          // Register before invoking initialize so partial allocations are also
          // released if this system throws halfway through its setup.
          initializedSystems.push(entry);
          await entry.initialize?.(context);
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
      const paused = kernel.pause();
      if (paused) cancelScheduledFrame();
      return paused;
    },
    resume() {
      ensureAvailable();
      const resumed = kernel.resume();
      if (resumed && frameLoopEnabled) {
        frameLoopLastTimestamp = frameLoopConfig.now();
        scheduleNextFrame();
      }
      return resumed;
    },
    startFrameLoop({
      requestFrame = globalThis.requestAnimationFrame,
      cancelFrame = globalThis.cancelAnimationFrame,
      now = () => globalThis.performance?.now?.() ?? Date.now()
    } = {}) {
      ensureAvailable();
      if (kernel.status !== 'running') return false;
      if (typeof requestFrame !== 'function') {
        throw new Error('requestAnimationFrame não está disponível para iniciar o Runtime.');
      }

      cancelScheduledFrame();
      frameLoopEnabled = true;
      frameLoopConfig = { requestFrame, cancelFrame, now };
      frameLoopLastTimestamp = now();
      const bridge = this;
      frameCallback = timestamp => {
        frameRequestId = null;
        if (!frameLoopEnabled || kernel.status !== 'running') return;
        const currentTimestamp = Number.isFinite(timestamp) ? timestamp : frameLoopConfig.now();
        const deltaSeconds = Math.max(0, (currentTimestamp - frameLoopLastTimestamp) / 1000);
        frameLoopLastTimestamp = currentTimestamp;
        try {
          bridge.update(deltaSeconds);
        } catch (error) {
          // Do not leave another animation frame queued after a failed system
          // update. The error remains visible to the host for diagnosis.
          stopFrameLoop();
          throw error;
        }
        scheduleNextFrame();
      };
      scheduleNextFrame();
      return true;
    },
    stopFrameLoop() {
      ensureAvailable();
      stopFrameLoop();
      return true;
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
      stopFrameLoop();
      await shutdownInitializedSystems();
      kernel.stop();
      return true;
    },
    async dispose() {
      if (disposed) return;
      stopFrameLoop();
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
