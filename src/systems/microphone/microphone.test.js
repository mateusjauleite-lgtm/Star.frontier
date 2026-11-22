import test from 'node:test';
import assert from 'node:assert/strict';
import { getMicrophoneCapabilities } from './microphoneCapabilities.js';
import { createMicrophonePermissionController, classifyMicrophoneError } from './microphonePermission.js';
import { createMicrophoneCapture } from './microphoneCapture.js';

test('capabilities detect WebView support without opening the microphone', () => {
  let requests = 0;
  const capabilities = getMicrophoneCapabilities({
    mediaDevices: { getUserMedia: async () => { requests++; } },
    permissions: { query: async () => ({ state: 'prompt' }) },
    SpeechRecognition: class {},
    secureContext: true
  });
  assert.equal(capabilities.supported, true);
  assert.equal(capabilities.permissionsApi, true);
  assert.equal(capabilities.speechRecognition, true);
  assert.equal(requests, 0);
});

test('permission controller inspects state without requesting capture', async () => {
  let requests = 0;
  const permissionStatus = { state: 'prompt', onchange: null };
  const controller = createMicrophonePermissionController({
    mediaDevices: { getUserMedia: async () => { requests++; } },
    permissions: { query: async () => permissionStatus }
  });
  assert.equal(await controller.inspect(), 'prompt');
  permissionStatus.state = 'granted';
  permissionStatus.onchange();
  assert.equal(controller.state, 'granted');
  assert.equal(requests, 0);
  controller.dispose();
  assert.equal(permissionStatus.onchange, null);
});

test('permission errors are normalized for a stable UI contract', () => {
  assert.deepEqual(classifyMicrophoneError({ name: 'NotAllowedError' }), {
    permission: 'denied', reason: 'permission-denied'
  });
  assert.equal(classifyMicrophoneError({ name: 'NotFoundError' }).reason, 'microphone-device-not-found');
});

test('capture owns one stream, connects analysis and stops every track', async () => {
  const calls = [];
  const track = {
    readyState: 'live', enabled: true,
    stop() { this.readyState = 'ended'; calls.push('track-stop'); },
    addEventListener() {}
  };
  const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
  const capture = createMicrophoneCapture({
    mediaDevices: { getUserMedia: async () => stream },
    connectInputStream: (_stream, options) => {
      calls.push(options.id);
      return { getLevel: () => 0.2, disconnect: () => calls.push('disconnect') };
    }
  });
  const result = await capture.start();
  assert.equal(result.ok, true);
  assert.equal(capture.getSnapshot().active, true);
  assert.equal(capture.getSnapshot().inputLevel, 0.2);
  assert.equal(capture.stop(), true);
  assert.equal(capture.getSnapshot().active, false);
  assert.deepEqual(calls, ['star-frontier-microphone', 'disconnect', 'track-stop']);
  capture.dispose();
});

test('capture cancels a pending permission request and stops the late stream', async () => {
  let resolveRequest;
  const track = { readyState: 'live', stop() { this.readyState = 'ended'; } };
  const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
  const capture = createMicrophoneCapture({
    mediaDevices: { getUserMedia: () => new Promise(resolve => { resolveRequest = resolve; }) },
    connectInputStream: () => { throw new Error('must-not-connect-cancelled-stream'); }
  });
  const pending = capture.start();
  capture.stop();
  resolveRequest(stream);
  const result = await pending;
  assert.equal(result.reason, 'capture-request-cancelled');
  assert.equal(track.readyState, 'ended');
  capture.dispose();
});
