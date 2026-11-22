import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioManager } from './audioManager.js';

function createCoreMock() {
  const calls = [];
  return {
    calls,
    isReady: false,
    isUnlocked: false,
    isMuted: false,
    contextState: 'not-created',
    setMasterVolume: value => calls.push(['master', value]),
    setBusVolume: (bus, value) => calls.push(['bus', bus, value]),
    setMuted: value => calls.push(['muted', value]),
    unlock: async () => { calls.push(['unlock']); return true; },
    connectInputStream: (stream, options) => {
      calls.push(['connect-input', options.id]);
      return { getLevel: () => 0.12, disconnect: () => calls.push(['disconnect-input']) };
    }
  };
}

function createStream() {
  const track = {
    readyState: 'live',
    enabled: true,
    stopped: false,
    stop() { this.stopped = true; this.readyState = 'ended'; },
    addEventListener() {}
  };
  return {
    track,
    getAudioTracks: () => [track],
    getTracks: () => [track]
  };
}

test('Audio Manager não solicita microfone ao ser inicializado', () => {
  const core = createCoreMock();
  let requests = 0;
  const manager = createAudioManager({
    core,
    mediaDevices: { getUserMedia: async () => { requests++; return createStream(); } },
    storage: null
  });
  assert.equal(requests, 0);
  assert.equal(manager.getSnapshot().microphone.active, false);
  manager.dispose();
});

test('pedido explícito autoriza e conecta a captura ao núcleo sem saída de monitoramento', async () => {
  const core = createCoreMock();
  const stream = createStream();
  let receivedConstraints;
  const manager = createAudioManager({
    core,
    mediaDevices: { getUserMedia: async constraints => { receivedConstraints = constraints; return stream; } },
    storage: null
  });
  const result = await manager.requestMicrophoneAccess();
  assert.equal(result.ok, true);
  assert.equal(result.active, true);
  assert.equal(manager.getSnapshot().microphone.permission, 'granted');
  assert.equal(manager.getSnapshot().microphone.inputLevel, 0.12);
  assert.equal(receivedConstraints.audio.echoCancellation, true);
  assert.equal(receivedConstraints.video, false);
  assert.ok(core.calls.some(call => call[0] === 'connect-input'));
  assert.equal(manager.stopMicrophone(), true);
  assert.equal(stream.track.stopped, true);
  assert.equal(manager.getSnapshot().microphone.active, false);
  manager.dispose();
});

test('permissão negada é informada sem derrubar o Audio Manager', async () => {
  const core = createCoreMock();
  const manager = createAudioManager({
    core,
    mediaDevices: { getUserMedia: async () => { const error = new Error('denied'); error.name = 'NotAllowedError'; throw error; } },
    storage: null
  });
  const result = await manager.requestMicrophoneAccess();
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'permission-denied');
  assert.equal(manager.getSnapshot().microphone.permission, 'denied');
  assert.equal(manager.getSnapshot().disposed, false);
  manager.dispose();
});

test('indisponibilidade de microfone retorna estado suportado', async () => {
  const manager = createAudioManager({ core: createCoreMock(), mediaDevices: null, storage: null });
  const result = await manager.requestMicrophoneAccess();
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'microphone-api-unavailable');
  assert.equal(manager.getSnapshot().microphone.supported, false);
  manager.dispose();
});

test('configurações de saída são compartilhadas e persistidas', () => {
  const core = createCoreMock();
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const manager = createAudioManager({ core, storage });
  manager.setMasterVolume(0.6);
  manager.setBusVolume('voice', 0.35);
  manager.setMuted(true);
  const saved = JSON.parse(values.get('star-frontier.audio-settings.v1'));
  assert.equal(saved.masterVolume, 0.6);
  assert.equal(saved.busVolumes.voice, 0.35);
  assert.equal(saved.muted, true);
  assert.deepEqual(manager.getSnapshot().output.busVolumes, { voice: 0.35 });
  manager.dispose();
});
