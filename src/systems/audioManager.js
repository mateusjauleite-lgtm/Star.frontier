/**
 * Gerenciador único de Áudio e Microfone do Star Frontier.
 *
 * Compõe o Audio Core existente com a captura de entrada. Não solicita
 * permissão durante a inicialização: o pedido só ocorre após ação explícita.
 * A captura é analisada, mas não é reproduzida nos alto-falantes por padrão.
 */
import { audioCore } from './audio.js';

const STORAGE_KEY = 'star-frontier.audio-settings.v1';

export function createAudioManager(options = {}) {
  const core = options.core || audioCore;
  const mediaDevices = options.mediaDevices ?? globalThis.navigator?.mediaDevices ?? null;
  const permissions = options.permissions ?? globalThis.navigator?.permissions ?? null;
  const storage = options.storage ?? safeLocalStorage();
  const listeners = new Set();
  let stream = null;
  let inputConnection = null;
  let permissionState = 'unknown';
  let lastError = null;
  let disposed = false;
  let settings = loadSettings(storage, options.initialSettings);

  function emit(reason) {
    const snapshot = getSnapshot();
    for (const callback of listeners) {
      try { callback(snapshot, reason); } catch (error) {
        console.error('[Star Frontier Audio Manager] Listener error:', error);
      }
    }
  }

  function persist() {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn('[Star Frontier Audio Manager] Não foi possível salvar as configurações:', error);
    }
  }

  function getSnapshot() {
    return {
      output: {
        ready: Boolean(core.isReady),
        unlocked: Boolean(core.isUnlocked),
        contextState: core.contextState,
        muted: Boolean(core.isMuted),
        masterVolume: settings.masterVolume,
        busVolumes: { ...settings.busVolumes }
      },
      microphone: {
        supported: Boolean(mediaDevices?.getUserMedia),
        permission: permissionState,
        active: Boolean(stream?.getAudioTracks?.().some(track => track.readyState === 'live' && track.enabled)),
        inputLevel: inputConnection?.getLevel?.() ?? 0,
        error: lastError
      },
      disposed
    };
  }

  function onChange(callback) {
    if (typeof callback !== 'function') throw new TypeError('O listener precisa ser uma função.');
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  async function refreshMicrophonePermission() {
    if (!mediaDevices?.getUserMedia) {
      permissionState = 'unsupported';
      emit('microphone-unsupported');
      return permissionState;
    }
    if (permissions?.query) {
      try {
        const result = await permissions.query({ name: 'microphone' });
        permissionState = result.state || 'unknown';
        result.onchange = () => {
          permissionState = result.state || 'unknown';
          emit('microphone-permission-change');
        };
      } catch {
        // Alguns WebViews não implementam Permissions API para microfone.
        permissionState = 'prompt';
      }
    } else {
      permissionState = 'prompt';
    }
    emit('microphone-permission-refresh');
    return permissionState;
  }

  async function requestMicrophoneAccess(constraints = {}) {
    if (disposed) return { ok: false, reason: 'manager-disposed' };
    if (!mediaDevices?.getUserMedia) {
      permissionState = 'unsupported';
      lastError = 'microphone-api-unavailable';
      emit('microphone-unsupported');
      return { ok: false, reason: lastError, snapshot: getSnapshot() };
    }
    if (globalThis.isSecureContext === false) {
      lastError = 'secure-context-required';
      emit('microphone-error');
      return { ok: false, reason: lastError, snapshot: getSnapshot() };
    }

    stopMicrophone();
    lastError = null;
    emit('microphone-requesting');

    try {
      // Deve ser chamado diretamente após toque/clique do usuário para abrir
      // o fluxo de autorização do navegador/WebView/Android.
      const requestedStream = await mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...constraints
        },
        video: false
      });
      const tracks = requestedStream.getAudioTracks?.() || [];
      if (tracks.length === 0) {
        for (const track of requestedStream.getTracks?.() || []) track.stop();
        throw new Error('no-audio-track');
      }
      const connection = core.connectInputStream(requestedStream, { id: 'star-frontier-microphone' });
      stream = requestedStream;
      inputConnection = connection;
      permissionState = 'granted';
      for (const track of tracks) {
        track.addEventListener?.('ended', () => {
          if (stream !== requestedStream) return;
          stopMicrophone();
          permissionState = 'unknown';
          emit('microphone-track-ended');
        }, { once: true });
      }
      emit('microphone-started');
      return { ok: true, active: true, tracks: tracks.length, snapshot: getSnapshot() };
    } catch (error) {
      const name = error?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
        permissionState = 'denied';
        lastError = 'permission-denied';
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        lastError = 'microphone-device-not-found';
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        lastError = 'microphone-device-busy';
      } else {
        lastError = error?.message || 'microphone-request-failed';
      }
      emit('microphone-error');
      return { ok: false, reason: lastError, snapshot: getSnapshot() };
    }
  }

  function stopMicrophone() {
    const hadStream = Boolean(stream);
    inputConnection?.disconnect?.();
    inputConnection = null;
    if (stream) {
      for (const track of stream.getTracks?.() || []) {
        try { track.stop(); } catch {}
      }
    }
    stream = null;
    if (hadStream) emit('microphone-stopped');
    return hadStream;
  }

  async function unlockOutput() {
    try {
      const unlocked = await core.unlock();
      emit('output-unlocked');
      return unlocked;
    } catch (error) {
      lastError = error?.message || 'audio-output-unavailable';
      emit('output-error');
      return false;
    }
  }

  function setMasterVolume(value) {
    settings.masterVolume = clamp(value, 0, 1);
    core.setMasterVolume(settings.masterVolume);
    persist();
    emit('output-volume-change');
    return settings.masterVolume;
  }

  function setBusVolume(bus, value) {
    const volume = clamp(value, 0, 1);
    settings.busVolumes[bus] = volume;
    core.setBusVolume(bus, volume);
    persist();
    emit('output-volume-change');
    return volume;
  }

  function setMuted(value) {
    settings.muted = Boolean(value);
    core.setMuted(settings.muted);
    persist();
    emit('output-mute-change');
    return settings.muted;
  }

  function dispose() {
    if (disposed) return;
    stopMicrophone();
    disposed = true;
    listeners.clear();
  }

  core.setMasterVolume(settings.masterVolume);
  core.setMuted(settings.muted);
  for (const [bus, volume] of Object.entries(settings.busVolumes)) {
    core.setBusVolume(bus, volume);
  }

  return Object.freeze({
    getSnapshot,
    onChange,
    refreshMicrophonePermission,
    requestMicrophoneAccess,
    stopMicrophone,
    unlockOutput,
    setMasterVolume,
    setBusVolume,
    setMuted,
    dispose
  });
}

function loadSettings(storage, initialSettings = {}) {
  let stored = {};
  try {
    stored = JSON.parse(storage?.getItem(STORAGE_KEY) || '{}') || {};
  } catch {}
  const source = { ...stored, ...(initialSettings || {}) };
  const busVolumes = {};
  for (const [name, value] of Object.entries(source.busVolumes || {})) {
    busVolumes[name] = clamp(value, 0, 1);
  }
  return {
    masterVolume: clamp(source.masterVolume ?? 1, 0, 1),
    muted: Boolean(source.muted),
    busVolumes
  };
}

function safeLocalStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

export const audioManager = createAudioManager();
