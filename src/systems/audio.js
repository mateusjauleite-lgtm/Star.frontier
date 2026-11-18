/**
 * Star Frontier — Núcleo central de áudio
 *
 * Responsabilidades:
 * - Gerenciar o AudioContext e o desbloqueio exigido pelos navegadores.
 * - Carregar e decodificar arquivos de áudio uma única vez.
 * - Separar música, efeitos, ambiente e voz em barramentos independentes.
 * - Controlar volume, mute, reprodução, parada e áudio espacial 3D.
 *
 * Os módulos das ramificações devem registrar seus arquivos com registerSound()
 * e solicitar reprodução com play(). Este núcleo não decide quando um evento
 * de jogo deve acontecer; essa responsabilidade pertence aos módulos clientes.
 */

const DEFAULT_BUSES = ['master', 'music', 'sfx', 'ambience', 'voice'];

export function createAudioCore(options = {}) {
  const config = {
    masterVolume: clamp(options.masterVolume ?? 1, 0, 1),
    busVolumes: options.busVolumes ?? {},
    muted: Boolean(options.muted),
    fetchImpl: options.fetchImpl ?? globalThis.fetch?.bind(globalThis)
  };

  let context = null;
  let masterGain = null;
  let unlocked = false;
  let disposed = false;

  const buses = new Map();
  const soundDefinitions = new Map();
  const decodedBuffers = new Map();
  const activeSources = new Map();
  const listeners = new Map();

  function emit(type, detail = {}) {
    const callbacks = listeners.get(type);
    if (!callbacks) return;

    for (const callback of callbacks) {
      try {
        callback(detail);
      } catch (error) {
        console.error('[Star Frontier Audio] Listener error:', error);
      }
    }
  }

  function on(type, callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('O callback do evento de áudio precisa ser uma função.');
    }

    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(callback);

    return () => listeners.get(type)?.delete(callback);
  }

  function ensureContext() {
    if (disposed) throw new Error('O núcleo de áudio já foi encerrado.');
    if (context) return context;

    const AudioContextClass =
      globalThis.AudioContext || globalThis.webkitAudioContext;

    if (!AudioContextClass) {
      emit('unsupported');
      throw new Error('Web Audio API não está disponível neste dispositivo.');
    }

    context = new AudioContextClass();
    masterGain = context.createGain();
    masterGain.gain.value = config.muted ? 0 : config.masterVolume;
    masterGain.connect(context.destination);

    for (const name of DEFAULT_BUSES) {
      createBus(name);
    }

    emit('ready', { sampleRate: context.sampleRate });
    return context;
  }

  function createBus(name) {
    if (buses.has(name)) return buses.get(name);

    const audioContext = context;
    if (!audioContext || !masterGain) {
      throw new Error('Inicialize o núcleo de áudio antes de criar barramentos.');
    }

    const gain = audioContext.createGain();
    const volume = clamp(config.busVolumes[name] ?? 1, 0, 1);
    gain.gain.value = volume;
    gain.connect(masterGain);
    buses.set(name, gain);
    return gain;
  }

  function getBus(name = 'sfx') {
    if (!context) ensureContext();
    return buses.get(name) || createBus(name);
  }

  async function unlock() {
    const audioContext = ensureContext();

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    unlocked = audioContext.state === 'running';
    emit('unlocked', { unlocked });
    return unlocked;
  }

  function registerSound(id, url, definition = {}) {
    if (!id || typeof id !== 'string') {
      throw new TypeError('O identificador do som precisa ser uma string.');
    }
    if (!url || typeof url !== 'string') {
      throw new TypeError('O caminho do arquivo de áudio precisa ser uma string.');
    }

    soundDefinitions.set(id, {
      url,
      bus: definition.bus || 'sfx',
      loop: Boolean(definition.loop),
      volume: clamp(definition.volume ?? 1, 0, 1),
      spatial: Boolean(definition.spatial),
      refDistance: Math.max(0.01, definition.refDistance ?? 1),
      maxDistance: Math.max(1, definition.maxDistance ?? 100),
      rolloffFactor: Math.max(0, definition.rolloffFactor ?? 1)
    });

    decodedBuffers.delete(id);
    return true;
  }

  async function load(id) {
    const definition = soundDefinitions.get(id);
    if (!definition) throw new Error(`Som não registrado: ${id}`);

    if (decodedBuffers.has(id)) return decodedBuffers.get(id);
    if (typeof config.fetchImpl !== 'function') {
      throw new Error('fetch não está disponível para carregar áudio.');
    }

    const response = await config.fetchImpl(definition.url);
    if (!response.ok) {
      throw new Error(`Falha ao carregar áudio "${id}": HTTP ${response.status}`);
    }

    const data = await response.arrayBuffer();
    const audioContext = ensureContext();
    const buffer = await audioContext.decodeAudioData(data.slice(0));
    decodedBuffers.set(id, buffer);
    emit('loaded', { id, duration: buffer.duration });
    return buffer;
  }

  async function play(id, playbackOptions = {}) {
    const definition = soundDefinitions.get(id);
    if (!definition) {
      emit('error', { id, error: new Error(`Som não registrado: ${id}`) });
      return null;
    }

    try {
      const audioContext = ensureContext();
      if (audioContext.state !== 'running') {
        await unlock();
      }

      const buffer = await load(id);
      const source = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      const busName = playbackOptions.bus || definition.bus;
      const bus = getBus(busName);

      source.buffer = buffer;
      source.loop = playbackOptions.loop ?? definition.loop;
      gain.gain.value = clamp(
        (playbackOptions.volume ?? 1) * definition.volume,
        0,
        1
      );

      source.connect(gain);

      let panner = null;
      if (playbackOptions.position || definition.spatial) {
        panner = audioContext.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = definition.refDistance;
        panner.maxDistance = definition.maxDistance;
        panner.rolloffFactor = definition.rolloffFactor;
        gain.connect(panner);
        panner.connect(bus);
        if (playbackOptions.position) {
          setPannerPosition(panner, playbackOptions.position);
        }
      } else {
        gain.connect(bus);
      }

      const instanceId = playbackOptions.instanceId ||
        `${id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

      const record = { id, source, gain, panner, busName };
      activeSources.set(instanceId, record);

      source.onended = () => {
        activeSources.delete(instanceId);
        try { source.disconnect(); } catch {}
        try { gain.disconnect(); } catch {}
        try { panner?.disconnect(); } catch {}
        emit('ended', { id, instanceId });
      };

      source.start(0, Math.max(0, playbackOptions.offset ?? 0));
      emit('played', { id, instanceId, bus: busName });
      return instanceId;
    } catch (error) {
      emit('error', { id, error });
      console.warn('[Star Frontier Audio] Não foi possível reproduzir:', id, error);
      return null;
    }
  }

  function stop(instanceId, fadeSeconds = 0) {
    const record = activeSources.get(instanceId);
    if (!record) return false;

    const now = context.currentTime;
    const fade = Math.max(0, fadeSeconds);

    try {
      if (fade > 0) {
        record.gain.gain.cancelScheduledValues(now);
        record.gain.gain.setValueAtTime(record.gain.gain.value, now);
        record.gain.gain.linearRampToValueAtTime(0, now + fade);
        record.source.stop(now + fade);
      } else {
        record.source.stop();
      }
    } catch (error) {
      emit('error', { id: record.id, error });
    }

    return true;
  }

  function stopBySound(id, fadeSeconds = 0) {
    let stopped = 0;
    for (const [instanceId, record] of activeSources) {
      if (record.id === id) {
        if (stop(instanceId, fadeSeconds)) stopped++;
      }
    }
    return stopped;
  }

  function stopAll(fadeSeconds = 0) {
    for (const instanceId of [...activeSources.keys()]) {
      stop(instanceId, fadeSeconds);
    }
  }

  function setBusVolume(name, volume) {
    const value = clamp(volume, 0, 1);
    config.busVolumes[name] = value;
    if (context) getBus(name).gain.setTargetAtTime(value, context.currentTime, 0.015);
    emit('volumechange', { bus: name, volume: value });
    return value;
  }

  function setMasterVolume(volume) {
    config.masterVolume = clamp(volume, 0, 1);
    if (masterGain && !config.muted) {
      masterGain.gain.setTargetAtTime(config.masterVolume, context.currentTime, 0.015);
    }
    emit('volumechange', { bus: 'master', volume: config.masterVolume });
    return config.masterVolume;
  }

  function setMuted(muted) {
    config.muted = Boolean(muted);
    if (masterGain) {
      masterGain.gain.setTargetAtTime(
        config.muted ? 0 : config.masterVolume,
        context.currentTime,
        0.015
      );
    }
    emit('mutechange', { muted: config.muted });
    return config.muted;
  }

  function setPannerPosition(panner, position) {
    const x = Number(position.x ?? position[0] ?? 0);
    const y = Number(position.y ?? position[1] ?? 0);
    const z = Number(position.z ?? position[2] ?? 0);

    if (panner.positionX) {
      panner.positionX.setValueAtTime(x, context.currentTime);
      panner.positionY.setValueAtTime(y, context.currentTime);
      panner.positionZ.setValueAtTime(z, context.currentTime);
    } else {
      panner.setPosition(x, y, z);
    }
  }

  function setListenerTransform(position, forward, up = { x: 0, y: 1, z: 0 }) {
    if (!context) return false;

    const listener = context.listener;
    const p = position || { x: 0, y: 0, z: 0 };
    const f = forward || { x: 0, y: 0, z: -1 };

    if (listener.positionX) {
      const now = context.currentTime;
      listener.positionX.setValueAtTime(p.x ?? 0, now);
      listener.positionY.setValueAtTime(p.y ?? 0, now);
      listener.positionZ.setValueAtTime(p.z ?? 0, now);
      listener.forwardX.setValueAtTime(f.x ?? 0, now);
      listener.forwardY.setValueAtTime(f.y ?? 0, now);
      listener.forwardZ.setValueAtTime(f.z ?? -1, now);
      listener.upX.setValueAtTime(up.x ?? 0, now);
      listener.upY.setValueAtTime(up.y ?? 1, now);
      listener.upZ.setValueAtTime(up.z ?? 0, now);
    } else {
      listener.setPosition(p.x ?? 0, p.y ?? 0, p.z ?? 0);
      listener.setOrientation(
        f.x ?? 0, f.y ?? 0, f.z ?? -1,
        up.x ?? 0, up.y ?? 1, up.z ?? 0
      );
    }

    return true;
  }

  async function playTone(options = {}) {
    try {
      const audioContext = ensureContext();
      if (audioContext.state !== 'running') await unlock();

      const duration = clamp(options.duration ?? 0.14, 0.025, 2);
      const volume = clamp(options.volume ?? 0.1, 0, 1);
      const frequency = clamp(options.frequency ?? 440, 30, 4000);
      const endFrequency = clamp(options.endFrequency ?? frequency, 30, 8000);
      const attack = Math.min(duration * 0.35, clamp(options.attack ?? 0.008, 0.002, 0.08));
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = ['sine', 'square', 'triangle', 'sawtooth'].includes(options.waveform)
        ? options.waveform
        : 'sine';
      oscillator.frequency.setValueAtTime(frequency, now);
      if (endFrequency !== frequency) {
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
      }

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(Math.max(0.0001, volume), now + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      oscillator.connect(gain);
      gain.connect(getBus(options.bus || 'sfx'));
      oscillator.start(now);
      oscillator.stop(now + duration + 0.015);
      oscillator.onended = () => {
        try { oscillator.disconnect(); } catch {}
        try { gain.disconnect(); } catch {}
      };
      return true;
    } catch (error) {
      emit('error', { id: 'procedural-tone', error });
      console.warn('[Star Frontier Audio] Não foi possível gerar efeito sonoro:', error);
      return false;
    }
  }

  async function dispose() {
    if (disposed) return;
    stopAll();
    disposed = true;
    listeners.clear();
    decodedBuffers.clear();
    soundDefinitions.clear();
    buses.clear();

    if (context && context.state !== 'closed') {
      await context.close();
    }

    context = null;
    masterGain = null;
    unlocked = false;
  }

  return {
    unlock,
    registerSound,
    load,
    play,
    playTone,
    stop,
    stopBySound,
    stopAll,
    setBusVolume,
    setMasterVolume,
    setMuted,
    setListenerTransform,
    on,
    dispose,
    get isReady() { return Boolean(context); },
    get isUnlocked() { return unlocked; },
    get isMuted() { return config.muted; },
    get activeCount() { return activeSources.size; },
    get contextState() { return context?.state ?? 'not-created'; }
  };
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

// Instância compartilhada opcional para os módulos que preferirem um núcleo único.
// A criação do AudioContext continua adiada até unlock() ou play().
export const audioCore = createAudioCore();
