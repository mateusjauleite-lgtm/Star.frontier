/** Gerencia uma única captura de microfone e sua conexão de análise no Audio Core. */
export function createMicrophoneCapture(options = {}) {
  const mediaDevices = options.mediaDevices ?? globalThis.navigator?.mediaDevices ?? null;
  const connectInputStream = options.connectInputStream;
  const onChange = options.onChange ?? (() => {});
  let stream = null;
  let input = null;
  let generation = 0;
  let disposed = false;

  function snapshot() {
    const tracks = stream?.getAudioTracks?.() || [];
    return {
      active: Boolean(!disposed && tracks.some(track => track.readyState === 'live' && track.enabled)),
      inputLevel: input?.getLevel?.() ?? 0,
      trackCount: tracks.length
    };
  }

  function emit(reason) {
    try { onChange(snapshot(), reason); } catch (error) {
      console.error('[Star Frontier Microphone Capture] Listener error:', error);
    }
  }

  function stop() {
    generation += 1;
    const previousStream = stream;
    const previousInput = input;
    stream = null;
    input = null;
    previousInput?.disconnect?.();
    for (const track of previousStream?.getTracks?.() || []) {
      try { track.stop(); } catch {}
    }
    if (previousStream || previousInput) emit('microphone-stopped');
    return Boolean(previousStream || previousInput);
  }

  async function start(constraints = {}) {
    if (disposed) return { ok: false, reason: 'capture-disposed' };
    if (typeof mediaDevices?.getUserMedia !== 'function') {
      return { ok: false, reason: 'microphone-api-unavailable' };
    }
    if (typeof connectInputStream !== 'function') {
      return { ok: false, reason: 'audio-input-connector-unavailable' };
    }

    stop();
    const requestGeneration = generation;
    let pendingStream = null;
    try {
      pendingStream = await mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...constraints
        },
        video: false
      });

      if (disposed || requestGeneration !== generation) {
        for (const track of pendingStream?.getTracks?.() || []) track.stop();
        return { ok: false, reason: 'capture-request-cancelled' };
      }

      const tracks = pendingStream?.getAudioTracks?.() || [];
      if (!tracks.length) throw new Error('no-audio-track');
      const connection = connectInputStream(pendingStream, { id: 'star-frontier-microphone' });
      stream = pendingStream;
      input = connection;
      pendingStream = null;
      const connectionStream = stream;

      for (const track of tracks) {
        track.addEventListener?.('ended', () => {
          if (stream !== connectionStream) return;
          stop();
          emit('microphone-track-ended');
        }, { once: true });
      }
      emit('microphone-started');
      return { ok: true, active: true, tracks: tracks.length };
    } catch (error) {
      for (const track of pendingStream?.getTracks?.() || []) {
        try { track.stop(); } catch {}
      }
      return { ok: false, error, reason: error?.message || 'microphone-request-failed' };
    }
  }

  function dispose() {
    if (disposed) return;
    stop();
    disposed = true;
  }

  return Object.freeze({ start, stop, dispose, getSnapshot: snapshot });
}
