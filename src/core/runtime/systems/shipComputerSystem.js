export function createShipComputerRuntimeSystem({
  registerSystems,
  boot,
  onboardAI = null,
  patrolIntervalSeconds = 15,
  onStage = () => {},
  onError = () => {},
  shutdown = () => {}
}) {
  if (typeof registerSystems !== 'function' || typeof boot !== 'function' ||
      typeof shutdown !== 'function') {
    throw new TypeError('O sistema do computador da nave está incompleto.');
  }

  let patrolElapsed = 0;
  const safePatrolInterval = Math.max(1, Number(patrolIntervalSeconds) || 15);

  return {
    priority: 30,
    initialize(context = {}) {
      onStage('registro do computador da nave');
      try {
        registerSystems();
      } catch (error) {
        onError(error, 'register');
      }

      try {
        boot();
        if (onboardAI) context.shipComputerAI = onboardAI;
      } catch (error) {
        onError(error, 'boot');
      }
    },
    update(deltaSeconds) {
      if (!onboardAI || typeof onboardAI.runPatrol !== 'function') return;
      const delta = Math.max(0, Number(deltaSeconds) || 0);
      patrolElapsed += delta;
      if (patrolElapsed < safePatrolInterval) return;
      patrolElapsed %= safePatrolInterval;
      try {
        onboardAI.runPatrol();
      } catch (error) {
        onError(error, 'ai-patrol');
      }
    },
    shutdown(context = {}) {
      onboardAI?.stopVoiceRecognition?.();
      if (context && 'shipComputerAI' in context) delete context.shipComputerAI;
      shutdown();
      patrolElapsed = 0;
    }
  };
}
