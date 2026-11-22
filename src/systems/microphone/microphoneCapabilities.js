/** Detecta capacidades de captura sem solicitar permissões nem abrir dispositivos. */
export function getMicrophoneCapabilities(options = {}) {
  const mediaDevices = options.mediaDevices ?? globalThis.navigator?.mediaDevices ?? null;
  const permissions = options.permissions ?? globalThis.navigator?.permissions ?? null;
  const Recognition = options.SpeechRecognition ??
    globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition ?? null;
  const secureContext = options.secureContext ?? globalThis.isSecureContext !== false;
  const getUserMedia = typeof mediaDevices?.getUserMedia === 'function';

  return Object.freeze({
    secureContext: Boolean(secureContext),
    getUserMedia,
    permissionsApi: typeof permissions?.query === 'function',
    speechRecognition: typeof Recognition === 'function',
    supported: Boolean(secureContext && getUserMedia),
    reason: !secureContext ? 'secure-context-required' : !getUserMedia ? 'microphone-api-unavailable' : null
  });
}
