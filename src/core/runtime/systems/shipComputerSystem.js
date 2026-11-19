export function createShipComputerRuntimeSystem({
  registerSystems,
  boot,
  onStage = () => {},
  onError = () => {},
  shutdown = () => {}
}) {
  if (typeof registerSystems !== 'function' || typeof boot !== 'function' ||
      typeof shutdown !== 'function') {
    throw new TypeError('O sistema do computador da nave está incompleto.');
  }

  return {
    priority: 30,
    initialize() {
      onStage('registro do computador da nave');
      try {
        registerSystems();
      } catch (error) {
        onError(error, 'register');
      }

      try {
        boot();
      } catch (error) {
        onError(error, 'boot');
      }
    },
    shutdown() {
      shutdown();
    }
  };
}
