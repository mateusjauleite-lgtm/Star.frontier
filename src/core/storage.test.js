import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { state } from './state.js';
import { loadState, saveState, STORAGE_KEY } from './storage.js';

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const originalState = {
  deflectorCoreEnergy: state.deflectorCoreEnergy,
  deflectorCoreEnabled: state.deflectorCoreEnabled,
  deflectorCoreChargingEnabled: state.deflectorCoreChargingEnabled,
  deflectorCoreTransferredTotal: state.deflectorCoreTransferredTotal,
  deflectorCoreConsumedTotal: state.deflectorCoreConsumedTotal,
  deflectorBranchConsumptionTotals: state.deflectorBranchConsumptionTotals
};

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    clear: () => values.clear()
  };
}

afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
  Object.assign(state, originalState);
});

test('save/load preserva carga, totais e estado do núcleo do defletor', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: createMemoryStorage()
  });
  state.deflectorCoreEnergy = 42.5;
  state.deflectorCoreEnabled = false;
  state.deflectorCoreChargingEnabled = true;
  state.deflectorCoreTransferredTotal = 18;
  state.deflectorCoreConsumedTotal = 7.25;
  state.deflectorBranchConsumptionTotals = { 'deflector-emitter': 5, 'deflector-sensors': 2.25 };

  assert.equal(saveState(), true);
  state.deflectorCoreEnergy = 0;
  state.deflectorCoreEnabled = true;
  state.deflectorCoreTransferredTotal = 0;
  state.deflectorCoreConsumedTotal = 0;
  state.deflectorBranchConsumptionTotals = {};

  assert.equal(loadState(), true);
  assert.equal(state.deflectorCoreEnergy, 42.5);
  assert.equal(state.deflectorCoreEnabled, false);
  assert.equal(state.deflectorCoreChargingEnabled, true);
  assert.equal(state.deflectorCoreTransferredTotal, 18);
  assert.equal(state.deflectorCoreConsumedTotal, 7.25);
  assert.deepEqual(state.deflectorBranchConsumptionTotals, {
    'deflector-emitter': 5,
    'deflector-sensors': 2.25
  });
});

test('load limita a carga salva à capacidade e descarta telemetria transitória', () => {
  const storage = createMemoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify({
    deflectorCoreEnergy: 150,
    deflectorCoreTelemetry: { energy: 150 },
    deflectorBranchConsumptionTotals: { emitter: -2, sensors: 'invalid', valid: 3 }
  }));
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });

  assert.equal(loadState(), true);
  assert.equal(state.deflectorCoreEnergy, 100);
  assert.equal(state.deflectorCoreTelemetry, null);
  assert.deepEqual(state.deflectorBranchConsumptionTotals, { valid: 3 });
});
