/**
 * Gerenciador único de Áudio e Microfone do Star Frontier.
 * Orquestra o Audio Core e os módulos especializados de microfone.
 * A inicialização consulta capacidades/permissões, mas nunca solicita captura.
 */
import { audioCore } from './audio.js';
import { getMicrophoneCapabilities } from './microphone/microphoneCapabilities.js';
import { createMicrophonePermissionController, classifyMicrophoneError } from './microphone/microphonePermission.js';
import { createMicrophoneCapture } from './microphone/microphoneCapture.js';

const STORAGE_KEY = 'star-frontier.audio-settings.v1';

export function createAudioManager(options = {}) {
  const core = options.core || audioCore;
  const mediaDevices = options.mediaDevices ?? globalThis.navigator?.mediaDevices ?? null;
  const permissions = options.permissions ?? globalThis.navigator?.permissions ?? null;
  const storage = options.storage ?? safeLocalStorage();
  const capabilities = getMicrophoneCapabilities({
    mediaDevices, permissions, secureContext: options.secureContext
  });
  const permission = createMicrophonePermissionController({ mediaDevices, permissions });
  const listeners = new Set();
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

  const capture = createMicrophoneCapture({
    mediaDevices,
    connectInputStream: (stream, captureOptions) => core.connectInputStream(stream, captureOptions),
    onChange: (_snapshot, reason) => emit(reason)
  });

  const unsubscribePermission = permission.onChange((state, reason) => {
    emit(reason || 'microphone-permission-change');
  });

  function getSnapshot() {
    const captureState = capture.getSnapshot();
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
        supported: capabilities.supported,
        secureContext: capabilities.secureContext,
        capabilityError: capabilities.reason,
        recognitionSupported: capabilities.speechRecognition,
        permission: permission.state,
        active: captureState.active,
        inputLevel: captureState.inputLevel,
        trackCount: captureState.trackCount,
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
    if (disposed) return permission.state;
    return permission.inspect();
  }

  async function initialize() {
    if (disposed) return getSnapshot();
    await refreshMicrophonePermission();
    emit('audio-manager-initialized');
    return getSnapshot();
  }

  async function requestMicrophoneAccess(constraints = {}) {
    if (disposed) return { ok: false, reason: 'manager-disposed' };
    if (!capabilities.supported) {
      lastError = capabilities.reason || 'microphone-api-unavailable';
      emit('microphone-unsupported');
      return { ok: false, reason: lastError, snapshot: getSnapshot() };
    }

    lastError = null;
    emit('microphone-requesting');
    const result = await capture.start(constraints);
    if (result.ok) {
      permission.setState('granted', 'microphone-permission-granted');
      emit('microphone-started');
      return { ok: true, active: true, tracks: result.tracks, snapshot: getSnapshot() };
    }

    const classified = classifyMicrophoneError(result.error);
    lastError = result.reason === 'no-audio-track'
      ? 'microphone-no-audio-track'
      : classified.reason;
    if (classified.permission) permission.setState(classified.permission, 'microphone-permission-denied');
    emit('microphone-error');
    return { ok: false, reason: lastError, snapshot: getSnapshot() };
  }

  function stopMicrophone() {
    return capture.stop();
  }

  async function unlockOutput() {
    if (disposed) return false;
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
    capture.dispose();
    unsubscribePermission();
    permission.dispose();
    disposed = true;
    listeners.clear();
  }

  core.setMasterVolume(settings.masterVolume);
  core.setMuted(settings.muted);
  for (const [bus, volume] of Object.entries(settings.busVolumes)) {
    core.setBusVolume(bus, volume);
  }

  return Object.freeze({
    initialize,
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
