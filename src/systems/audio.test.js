import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioCore } from './audio.js';

test('Audio Core conecta entrada de microfone ao analisador sem enviar sinal ao barramento de saída', async () => {
  const connections = [];
  class FakeAudioContext {
    constructor() {
      this.state = 'running';
      this.sampleRate = 48000;
      this.destination = {};
      this.currentTime = 0;
      this.listener = {};
    }
    createGain() {
      return { gain: { value: 1, setTargetAtTime() {} }, connect: target => connections.push(['gain', target]) };
    }
    createMediaStreamSource(stream) {
      return { stream, connect: target => connections.push(['source', target]), disconnect: () => connections.push(['source-disconnect']) };
    }
    createAnalyser() {
      return {
        fftSize: 0,
        smoothingTimeConstant: 0,
        connect: target => connections.push(['analyser', target]),
        disconnect: () => connections.push(['analyser-disconnect']),
        getByteTimeDomainData: samples => samples.fill(128)
      };
    }
    async close() { this.state = 'closed'; }
  }
  const previous = globalThis.AudioContext;
  globalThis.AudioContext = FakeAudioContext;
  try {
    const core = createAudioCore();
    const stream = { getAudioTracks: () => [{ readyState: 'live', enabled: true }] };
    const input = core.connectInputStream(stream, { id: 'test-mic' });
    assert.equal(core.inputCount, 1);
    assert.equal(input.active, true);
    assert.equal(input.getLevel(), 0);
    assert.deepEqual(connections.filter(item => item[0] === 'source').length, 1);
    assert.deepEqual(connections.filter(item => item[0] === 'analyser').length, 0);
    assert.equal(input.disconnect(), true);
    assert.equal(core.inputCount, 0);
    await core.dispose();
  } finally {
    if (previous === undefined) delete globalThis.AudioContext;
    else globalThis.AudioContext = previous;
  }
});
