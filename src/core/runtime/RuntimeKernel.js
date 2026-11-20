const STATUS = Object.freeze({
  created: 0,
  ready: 1,
  running: 2,
  paused: 3,
  stopped: 4
});

const STATUS_NAMES = Object.freeze(['created', 'ready', 'running', 'paused', 'stopped']);

const REQUIRED_WASM_EXPORTS = [
  '_runtime_create',
  '_runtime_destroy',
  '_runtime_initialize',
  '_runtime_start',
  '_runtime_pause',
  '_runtime_resume',
  '_runtime_stop',
  '_runtime_tick',
  '_runtime_get_status',
  '_runtime_get_frame_count',
  '_runtime_get_elapsed_seconds',
  '_runtime_get_delta_seconds'
];

export function createRuntimeKernel(module, { maximumDeltaSeconds = 0.04 } = {}) {
  if (!module || typeof module._runtime_create !== 'function') {
    throw new TypeError('O módulo WebAssembly do Runtime é inválido.');
  }
  const missingExports = REQUIRED_WASM_EXPORTS.filter(name => typeof module[name] !== 'function');
  if (missingExports.length) {
    throw new TypeError('O módulo WebAssembly do Runtime está incompleto: ' + missingExports.join(', '));
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


function createFallbackRuntimeKernel(maximumDeltaSeconds = 0.04) {
  const maximumDelta = Number.isFinite(maximumDeltaSeconds) && maximumDeltaSeconds > 0
    ? maximumDeltaSeconds
    : 0.04;
  let status = 'created';
  let frameCount = 0;
  let elapsedSeconds = 0;
  let deltaSeconds = 0;

  return {
    get status() { return status; },
    get frameCount() { return frameCount; },
    get elapsedSeconds() { return elapsedSeconds; },
    get deltaSeconds() { return deltaSeconds; },
    initialize() {
      if (status !== 'created' && status !== 'stopped') return false;
      frameCount = 0;
      elapsedSeconds = 0;
      deltaSeconds = 0;
      status = 'ready';
      return true;
    },
    start() { if (status !== 'ready') return false; status = 'running'; return true; },
    pause() { if (status !== 'running') return false; status = 'paused'; deltaSeconds = 0; return true; },
    resume() { if (status !== 'paused') return false; status = 'running'; return true; },
    stop() { status = 'stopped'; deltaSeconds = 0; return true; },
    tick(value) {
      if (status !== 'running' || !Number.isFinite(value) || value < 0) {
        deltaSeconds = 0;
        return 0;
      }
      deltaSeconds = Math.min(value, maximumDelta);
      elapsedSeconds += deltaSeconds;
      frameCount += 1;
      return deltaSeconds;
    },
    dispose() { status = 'disposed'; }
  };
}

export async function loadRuntimeKernel({ maximumDeltaSeconds = 0.04 } = {}) {
  const base = import.meta.env?.BASE_URL ?? './';
  const moduleUrl = new URL(
    base + 'core/runtime.js',
    globalThis.location?.href ?? 'http://localhost/'
  );

  try {
    const imported = await import(/* @vite-ignore */ moduleUrl.href);
    if (typeof imported.default !== 'function') {
      throw new Error('A fábrica WebAssembly do Runtime não foi encontrada.');
    }

    const wasm = await imported.default({
      locateFile: file => new URL(file, moduleUrl).href
    });

    return createRuntimeKernel(wasm, { maximumDeltaSeconds });
  } catch (error) {
    console.warn('Runtime C++/WASM indisponível; usando núcleo JavaScript de contingência.', error);
    return createFallbackRuntimeKernel(maximumDeltaSeconds);
  }
}

export { STATUS as RUNTIME_STATUS };
