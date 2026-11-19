const STATUS = Object.freeze({
  created: 0,
  ready: 1,
  running: 2,
  paused: 3,
  stopped: 4
});

const STATUS_NAMES = Object.freeze(['created', 'ready', 'running', 'paused', 'stopped']);

export function createRuntimeKernel(module, { maximumDeltaSeconds = 0.04 } = {}) {
  if (!module || typeof module._runtime_create !== 'function') {
    throw new TypeError('O módulo WebAssembly do Runtime é inválido.');
  }

  const handle = module._runtime_create(maximumDeltaSeconds);
  if (!handle) throw new Error('Não foi possível criar o Runtime C++.');

  let disposed = false;
  const ensureActive = () => {
    if (disposed) throw new Error('O Runtime C++ já foi liberado.');
  };

  return {
    get status() {
      if (disposed) return 'disposed';
      return STATUS_NAMES[module._runtime_get_status(handle)] ?? 'unknown';
    },
    get frameCount() {
      return disposed ? 0 : module._runtime_get_frame_count(handle);
    },
    get elapsedSeconds() {
      return disposed ? 0 : module._runtime_get_elapsed_seconds(handle);
    },
    get deltaSeconds() {
      return disposed ? 0 : module._runtime_get_delta_seconds(handle);
    },
    initialize() {
      ensureActive();
      return module._runtime_initialize(handle) === 1;
    },
    start() {
      ensureActive();
      return module._runtime_start(handle) === 1;
    },
    pause() {
      ensureActive();
      return module._runtime_pause(handle) === 1;
    },
    resume() {
      ensureActive();
      return module._runtime_resume(handle) === 1;
    },
    stop() {
      ensureActive();
      return module._runtime_stop(handle) === 1;
    },
    tick(deltaSeconds) {
      ensureActive();
      return module._runtime_tick(handle, deltaSeconds);
    },
    dispose() {
      if (disposed) return;
      module._runtime_destroy(handle);
      disposed = true;
    }
  };
}

export async function loadRuntimeKernel({ maximumDeltaSeconds = 0.04 } = {}) {
  const base = import.meta.env?.BASE_URL ?? './';
  const moduleUrl = new URL(
    base + 'core/runtime.js',
    globalThis.location?.href ?? 'http://localhost/'
  );

  const imported = await import(/* @vite-ignore */ moduleUrl.href);
  if (typeof imported.default !== 'function') {
    throw new Error('A fábrica WebAssembly do Runtime não foi encontrada.');
  }

  const wasm = await imported.default({
    locateFile: file => new URL(file, moduleUrl).href
  });

  return createRuntimeKernel(wasm, { maximumDeltaSeconds });
}

export { STATUS as RUNTIME_STATUS };
