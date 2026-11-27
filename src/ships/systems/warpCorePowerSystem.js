// Barramento elétrico gerado pelo núcleo de dobra e condicionado pela matriz de dilítio.
// A matriz converte dilítio refinado da reserva compartilhada em plasma estabilizado.
// O núcleo consome plasma para gerar EPS; os consumidores recebem energia pelos barramentos.
const DEFAULTS = Object.freeze({
  criticalCapacity: 80,
  operationsCapacity: 50,
  warpCapacity: 80,
  idleOutputPerSecond: 16,
  warpOutputPerSecond: 36,
  criticalShare: 0.45,
  operationsShare: 0.25,
  warpShare: 0.30,
  maxTransferPerSecond: 18,
  matrixRegulation: 1,
  plasmaCapacity: 250,
  plasmaMatrixRate: 0.18,
  plasmaPerEnergy: 0.0025
});
const EPSILON = 1e-9;

export function createWarpCorePowerSystem(options = {}) {
  const state = options.state || {};
  const config = { ...DEFAULTS, ...(options.config || {}) };
  const reactionSource = options.reactionSource || null;
  state.plasmaCapacity = positive(state.plasmaCapacity) || positive(config.plasmaCapacity) || 250;
  state.plasma = state.plasma === undefined ? (nonNegative(state.refinedDilithium) > EPSILON ? 100 : 0) : clamp(state.plasma, 0, state.plasmaCapacity);
  state.plasmaProducedTotal = nonNegative(state.plasmaProducedTotal);
  state.plasmaConsumedTotal = nonNegative(state.plasmaConsumedTotal);
  state.matrixDilithiumConsumedTotal = nonNegative(state.matrixDilithiumConsumedTotal);
  state.warpCorePlasmaConsumptionRate = 0;
  const persist = typeof options.persist === 'function' ? options.persist : () => {};
  const buffers = {
    critical: clamp(state.warpCoreCriticalBuffer, 0, positive(config.criticalCapacity)),
    operations: clamp(state.warpCoreOperationsBuffer, 0, positive(config.operationsCapacity)),
    warp: clamp(state.warpCoreWarpBuffer, 0, positive(config.warpCapacity))
  };
  let telemetry = null;
  let generatedTotal = nonNegative(state.warpCoreGeneratedTotal);
  let deliveredTotal = nonNegative(state.warpCoreDeliveredTotal);
  let generatedThisFrame = 0;
  let transferThisFrame = 0;
  let elapsed = 0;
  let lastOutputPerSecond = 0;
  let lastMatrixOnline = false;
  const frameDrawn = { critical: 0, operations: 0, warp: 0 };
  const nacelleDeliveryThisFrame = { port: 0, starboard: 0 };

  state.warpCoreEnabled = state.warpCoreEnabled !== false;
  state.warpCoreMatrixEnabled = state.warpCoreMatrixEnabled !== false;
  state.warpCoreContainmentStable = state.warpCoreContainmentStable !== false;
  state.warpCoreMatrixRegulation = clamp(
    state.warpCoreMatrixRegulation ?? config.matrixRegulation, 0, 1
  );
  state.warpCoreCriticalBuffer = buffers.critical;
  state.warpCoreOperationsBuffer = buffers.operations;
  state.warpCoreWarpBuffer = buffers.warp;

  const busFor = name => Object.freeze({
    draw(amount, dt) { return draw(name, amount, dt); },
    snapshot() { return bufferSnapshot(name); }
  });
  const powerBuses = Object.freeze({
    critical: busFor('critical'),
    operations: busFor('operations'),
    warp: busFor('warp')
  });

  function draw(name, requestedValue, deltaValue, routeToNacelles = false) {
    const requested = Math.max(0, finite(requestedValue));
    const dt = Math.max(0, finite(deltaValue));
    const matrixOnline = state.warpCoreEnabled && state.warpCoreContainmentStable &&
      state.warpCoreMatrixEnabled;
    if (requested <= EPSILON || dt <= 0 || !matrixOnline) return 0;
    const frameAllowance = Math.max(0, positive(config.maxTransferPerSecond) * dt - frameDrawn[name]);
    const delivered = Math.min(requested, buffers[name], frameAllowance);
    if (delivered > 0) {
      buffers[name] = Math.max(0, buffers[name] - delivered);
      frameDrawn[name] += delivered;
      deliveredTotal += delivered;
      transferThisFrame += delivered;
      if (name === 'warp' && routeToNacelles) {
        const perNacelle = delivered * 0.5;
        nacelleDeliveryThisFrame.port += perNacelle;
        nacelleDeliveryThisFrame.starboard += delivered - perNacelle;
      }
      syncState();
      telemetry = snapshot({ matrixOnline: lastMatrixOnline, outputPerSecond: lastOutputPerSecond });
      state.warpCorePowerTelemetry = telemetry;
    }
    return delivered;
  }

  function update(deltaValue) {
    const dt = Math.max(0, finite(deltaValue));
    generatedThisFrame = 0;
    transferThisFrame = 0;
    frameDrawn.critical = 0;
    frameDrawn.operations = 0;
    frameDrawn.warp = 0;
    nacelleDeliveryThisFrame.port = 0;
    nacelleDeliveryThisFrame.starboard = 0;
    state.warpCorePowerBusConnected = true;
    state.requestWarpPower = (amount, delta = dt) => draw('warp', amount, delta, true);
    state.requestOperationsPower = (amount, delta = dt) => draw('operations', amount, delta);
    state.requestCriticalPower = (amount, delta = dt) => draw('critical', amount, delta);
    if (dt <= 0) { telemetry = snapshot(); state.warpCorePowerTelemetry = telemetry; return telemetry; }

    // A matriz converte dilítio refinado da Refinaria em plasma estabilizado.
    // O núcleo consome plasma e entrega energia EPS aos barramentos.
    const plasmaCapacity = positive(state.plasmaCapacity);
    const matrixCanProcess = Boolean(state.warpCoreEnabled && state.warpCoreContainmentStable && state.warpCoreMatrixEnabled);
    if (matrixCanProcess && state.plasma < plasmaCapacity * 0.35 && nonNegative(state.refinedDilithium) > EPSILON) {
      const converted = Math.min(nonNegative(state.refinedDilithium), positive(config.plasmaMatrixRate) * dt, plasmaCapacity - state.plasma);
      if (converted > 0) {
        state.refinedDilithium = Math.max(0, state.refinedDilithium - converted);
        state.plasma = Math.min(plasmaCapacity, state.plasma + converted);
        state.matrixDilithiumConsumedTotal += converted;
        state.plasmaProducedTotal += converted;
      }
    }
    const matrixOnline = Boolean(state.warpCoreEnabled && state.warpCoreContainmentStable && state.warpCoreMatrixEnabled && nonNegative(state.plasma) > EPSILON);
    const requestedOutput = state.warpDriveButton || state.warpDriveActive
      ? positive(config.warpOutputPerSecond)
      : positive(config.idleOutputPerSecond);
    const regulation = clamp(state.warpCoreMatrixRegulation, 0, 1);
    const sourceOutput = reactionSource && typeof reactionSource.produce === 'function'
      ? Math.max(0, finite(reactionSource.produce(requestedOutput, dt, snapshot())))
      : requestedOutput;
    const plasmaRate = positive(config.plasmaPerEnergy);
    const plasmaLimitedOutput = dt > 0 ? nonNegative(state.plasma) / (dt * plasmaRate) : 0;
    const outputPerSecond = matrixOnline ? Math.min(requestedOutput, sourceOutput, plasmaLimitedOutput) * regulation : 0;
    const plasmaConsumed = Math.min(nonNegative(state.plasma), outputPerSecond * plasmaRate * dt);
    state.plasma = Math.max(0, state.plasma - plasmaConsumed);
    state.plasmaConsumedTotal += plasmaConsumed;
    state.warpCorePlasmaConsumptionRate = dt > 0 ? plasmaConsumed / dt : 0;
    lastOutputPerSecond = outputPerSecond;
    lastMatrixOnline = matrixOnline;
    const generated = outputPerSecond * dt;

    if (generated > 0) {
      const shares = [
        ['critical', clamp(config.criticalShare, 0, 1)],
        ['operations', clamp(config.operationsShare, 0, 1)],
        ['warp', clamp(config.warpShare, 0, 1)]
      ];
      const shareTotal = shares.reduce((sum, [, share]) => sum + share, 0) || 1;
      for (const [name, share] of shares) {
        const capacity = positive(config[name + 'Capacity']);
        const portion = generated * share / shareTotal;
        buffers[name] = Math.min(capacity, buffers[name] + portion);
      }
      generatedThisFrame = generated;
      generatedTotal += generated;
      syncState();
    }

    elapsed += dt;
    if (elapsed >= 5) {
      elapsed %= 5;
      persist();
    }
    telemetry = snapshot({ matrixOnline, outputPerSecond });
    state.warpCorePowerTelemetry = telemetry;
    return telemetry;
  }

  function bufferSnapshot(name) {
    const capacity = positive(config[name + 'Capacity']);
    return Object.freeze({ energy: buffers[name], capacity, fill: capacity ? buffers[name] / capacity : 0 });
  }

  function syncState() {
    state.warpCoreCriticalBuffer = buffers.critical;
    state.warpCoreOperationsBuffer = buffers.operations;
    state.warpCoreWarpBuffer = buffers.warp;
    state.warpCoreGeneratedTotal = generatedTotal;
    state.warpCoreDeliveredTotal = deliveredTotal;
  }

  function snapshot(overrides = {}) {
    const matrixOnline = overrides.matrixOnline ?? Boolean(
      state.warpCoreEnabled && state.warpCoreContainmentStable &&
      state.warpCoreMatrixEnabled && nonNegative(state.plasma) > EPSILON
    );
    return Object.freeze({
      enabled: Boolean(state.warpCoreEnabled),
      phase: !state.warpCoreEnabled ? 'offline'
        : !state.warpCoreContainmentStable ? 'containment-unstable'
          : !state.warpCoreMatrixEnabled ? 'matrix-disabled'
            : !matrixOnline ? (nonNegative(state.refinedDilithium) > EPSILON ? 'plasma-unavailable' : 'dilithium-unavailable')
              : (state.warpDriveButton || state.warpDriveActive ? 'warp-output' : 'idle'),
      containmentStable: Boolean(state.warpCoreContainmentStable),
      matrix: Object.freeze({
        enabled: Boolean(state.warpCoreMatrixEnabled),
        online: matrixOnline,
        regulation: clamp(state.warpCoreMatrixRegulation, 0, 1),
        dilithiumFeedstock: nonNegative(state.refinedDilithium),
        dilithiumConvertedTotal: nonNegative(state.matrixDilithiumConsumedTotal)
      }),
      plasma: Object.freeze({ amount: nonNegative(state.plasma), capacity: positive(state.plasmaCapacity), producedTotal: nonNegative(state.plasmaProducedTotal), consumedTotal: nonNegative(state.plasmaConsumedTotal), consumptionRate: nonNegative(state.warpCorePlasmaConsumptionRate) }),
      outputPerSecond: overrides.outputPerSecond ?? 0,
      generatedThisFrame,
      generatedTotal,
      deliveredThisFrame: transferThisFrame,
      deliveredTotal,
      buses: Object.freeze({
        critical: bufferSnapshot('critical'),
        operations: bufferSnapshot('operations'),
        warp: bufferSnapshot('warp')
      }),
      nacelles: Object.freeze({
        port: Object.freeze({
          available: Boolean(matrixOnline && buffers.warp > EPSILON),
          online: Boolean(matrixOnline && nacelleDeliveryThisFrame.port > EPSILON),
          deliveredThisFrame: nacelleDeliveryThisFrame.port
        }),
        starboard: Object.freeze({
          available: Boolean(matrixOnline && buffers.warp > EPSILON),
          online: Boolean(matrixOnline && nacelleDeliveryThisFrame.starboard > EPSILON),
          deliveredThisFrame: nacelleDeliveryThisFrame.starboard
        })
      })
    });
  }

  function publishSnapshot() {
    telemetry = snapshot();
    state.warpCorePowerTelemetry = telemetry;
    return telemetry;
  }
  function setEnabled(value) { state.warpCoreEnabled = Boolean(value); return publishSnapshot(); }
  function setMatrixEnabled(value) { state.warpCoreMatrixEnabled = Boolean(value); return publishSnapshot(); }
  function setContainmentStable(value) { state.warpCoreContainmentStable = Boolean(value); return publishSnapshot(); }
  function setMatrixRegulation(value) {
    state.warpCoreMatrixRegulation = clamp(value, 0, 1);
    return publishSnapshot();
  }
  function initialize() {
    state.warpCorePowerBusConnected = true;
    state.requestWarpPower = (amount, dt = 0) => draw('warp', amount, dt, true);
    state.requestOperationsPower = (amount, dt = 0) => draw('operations', amount, dt);
    state.requestCriticalPower = (amount, dt = 0) => draw('critical', amount, dt);
    telemetry = snapshot();
    state.warpCorePowerTelemetry = telemetry;
    return telemetry;
  }
  function shutdown() {
    syncState();
    state.warpCorePowerBusConnected = false;
    delete state.requestWarpPower;
    delete state.requestOperationsPower;
    delete state.requestCriticalPower;
    state.warpCorePowerTelemetry = null;
    persist();
  }
  function systemUpdate(dt) { return update(dt); }

  return Object.freeze({
    priority: 39,
    powerBus: powerBuses.warp,
    powerBuses,
    initialize,
    update: systemUpdate,
    shutdown,
    snapshot: () => telemetry || snapshot(),
    setEnabled,
    setMatrixEnabled,
    setContainmentStable,
    setMatrixRegulation
  });
}

function finite(value) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
function nonNegative(value) { return Math.max(0, finite(value)); }
function positive(value) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : 0; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, finite(value))); }
