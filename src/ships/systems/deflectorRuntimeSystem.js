import { state as sharedState } from '../../core/state.js';
import { saveState } from '../../core/storage.js';
import { createDeflectorCoreSystem } from './deflectorCoreSystem.js';
import { createDeflectorEmitterSystem } from './deflectorEmitterSystem.js';
import { createDeflectorSensorSystem } from './deflectorSensorSystem.js';

const AUTOSAVE_INTERVAL_SECONDS = 5;

export function createDeflectorRuntimeSystem(options = {}) {
  const state = options.state || sharedState;
  if (!state || typeof state !== 'object') throw new TypeError('O estado da nave é obrigatório.');

  const persist = typeof options.persist === 'function' ? options.persist : saveState;
  const core = createDeflectorCoreSystem(state, options.core);
  const emitter = createDeflectorEmitterSystem(core, options.emitter);
  const sensors = createDeflectorSensorSystem(core, options.sensors);
  let autosaveElapsed = 0;
  let telemetry = null;

  function update(deltaSeconds) {
    const dt = Math.max(0, finite(deltaSeconds));
    core.update(dt);
    const emitterStatus = emitter.update(dt);
    const sensorStatus = sensors.update(dt);
    const coreStatus = core.snapshot();
    telemetry = Object.freeze({
      ...coreStatus,
      emitter: emitterStatus,
      sensors: sensorStatus
    });
    // Telemetria é transitória: fica disponível aos consoles sem entrar no save.
    state.deflectorCoreTelemetry = telemetry;

    autosaveElapsed += dt;
    if (autosaveElapsed >= AUTOSAVE_INTERVAL_SECONDS) {
      autosaveElapsed %= AUTOSAVE_INTERVAL_SECONDS;
      persist();
    }
    return telemetry;
  }

  function shutdown() {
    persist();
  }

  return Object.freeze({
    priority: 45,
    initialize() {
      telemetry = core.snapshot();
      state.deflectorCoreTelemetry = telemetry;
    },
    update,
    shutdown,
    snapshot() {
      return telemetry || core.snapshot();
    },
    setCoreEnabled: value => core.setEnabled(value),
    setChargingEnabled: value => core.setChargingEnabled(value),
    setEmitterEnabled: value => emitter.setEnabled(value),
    setSensorsEnabled: value => sensors.setEnabled(value)
  });
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
