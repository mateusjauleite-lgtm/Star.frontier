/** Consulta e acompanha o estado de permissão. Nunca abre o microfone. */
export function createMicrophonePermissionController(options = {}) {
  const permissions = options.permissions ?? globalThis.navigator?.permissions ?? null;
  const mediaDevices = options.mediaDevices ?? globalThis.navigator?.mediaDevices ?? null;
  let state = 'unknown';
  let permissionStatus = null;
  let disposed = false;
  const listeners = new Set();

  function emit(reason) {
    for (const listener of listeners) {
      try { listener(state, reason); } catch (error) {
        console.error('[Star Frontier Microphone Permission] Listener error:', error);
      }
    }
  }

  function setState(next, reason = 'permission-state-change') {
    if (disposed) return state;
    state = next || 'unknown';
    emit(reason);
    return state;
  }

  async function inspect() {
    if (disposed) return state;
    if (typeof mediaDevices?.getUserMedia !== 'function') {
      return setState('unsupported', 'microphone-unsupported');
    }
    if (typeof permissions?.query !== 'function') {
      return setState('prompt', 'permission-api-unavailable');
    }

    try {
      if (permissionStatus) permissionStatus.onchange = null;
      permissionStatus = await permissions.query({ name: 'microphone' });
      if (disposed) return state;
      permissionStatus.onchange = () => {
        if (!disposed) setState(permissionStatus?.state || 'unknown', 'permission-change');
      };
      return setState(permissionStatus.state || 'unknown', 'permission-inspected');
    } catch {
      // Alguns WebViews não implementam a consulta de permissão para microfone.
      return setState('prompt', 'permission-query-unsupported');
    }
  }

  function onChange(listener) {
    if (typeof listener !== 'function') throw new TypeError('O listener precisa ser uma função.');
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (permissionStatus) permissionStatus.onchange = null;
    permissionStatus = null;
    listeners.clear();
  }

  return Object.freeze({
    inspect,
    setState,
    onChange,
    get state() { return state; },
    dispose
  });
}

export function classifyMicrophoneError(error) {
  const name = error?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return { permission: 'denied', reason: 'permission-denied' };
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return { permission: null, reason: 'microphone-device-not-found' };
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return { permission: null, reason: 'microphone-device-busy' };
  }
  return { permission: null, reason: error?.message || 'microphone-request-failed' };
}
