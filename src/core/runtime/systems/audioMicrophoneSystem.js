/** Adapta o controlador único de Áudio/Microfone ao ciclo de vida do Runtime. */
export function createAudioMicrophoneRuntimeSystem(manager) {
  if (!manager || typeof manager.getSnapshot !== 'function' ||
      typeof manager.refreshMicrophonePermission !== 'function') {
    throw new TypeError('O Audio Manager não implementa o contrato esperado pelo Runtime.');
  }

  return {
    priority: -100,
    async initialize(context = {}) {
      context.audioManager = manager;
      await manager.initialize?.();
      context.audioSnapshot = manager.getSnapshot();
    },
    update(_deltaSeconds, context = {}) {
      // Estado é orientado a eventos; não consultar permissões nem abrir captura por frame.
      context.audioSnapshot = manager.getSnapshot();
    },
    shutdown(context = {}) {
      manager.stopMicrophone?.();
      if (context.audioManager === manager) delete context.audioManager;
      delete context.audioSnapshot;
    }
  };
}
