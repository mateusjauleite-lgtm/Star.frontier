import { WARP_STAGE_SPEEDS, WARP_DILITHIUM_CONSUMPTION } from '../flight/flightDynamics.js';
import { RESOURCE_IDS } from '../../core/resources/resourceCatalog.js';
import { DILITHIUM_MATRIX_TERMINAL_ID } from './dilithiumMatrixTerminalController.js';
// Adaptadores entre o computador central e os sistemas reais da nave.
// Ponte e Engenharia consultam e comandam a mesma fonte de estado.
const PROPULSION_INPUTS = new Set(['throttle', 'braking', 'warpDriveButton', 'maneuverLeft', 'maneuverRight', 'maneuverUp', 'maneuverDown']);
const CONTROL_AUTHORITIES = new Set(['bridge', 'engineering', 'automatic']);
const WARP_EXIT_MODES = new Set(['smooth', 'direct']);

export function registerShipComputerSystems(computer, { state, getShip, getShipYaw, getPitchAngle, getAsteroids, shieldSystem = null, refinerySystem = null, deflectorRuntime = null, warpCoreSystem = null, planetaryTransportCore = null, getShipTransporterPosition = null }) {
  if (!computer || !state || typeof getShip !== 'function' || typeof getShipYaw !== 'function' || typeof getPitchAngle !== 'function' || typeof getAsteroids !== 'function') {
    throw new TypeError('Dependências dos sistemas do computador incompletas.');
  }

  const readShip = () => {
    const ship = getShip();
    return ship?.position ? ship : null;
  };
  const readNavigation = () => {
    const ship = readShip();
    if (!ship) return { available: false };
    const { x, y, z } = ship.position;
    return { available: true, position: { x, y, z }, heading: getShipYaw(), pitch: getPitchAngle(), speed: state.speed };
  };
  const readPersonalRawOre = () => {
    const inventory = state.inventory && typeof state.inventory === 'object' ? state.inventory : {};
    const items = [...(Array.isArray(inventory.items) ? inventory.items : []), ...(Array.isArray(inventory.overflowItems) ? inventory.overflowItems : [])];
    return items.reduce((total, item) => {
      const id = item?.definitionId || item?.itemId;
      return id === 'ore.dilithium.raw' ? total + Math.max(0, Number(item.quantity) || 0) : total;
    }, 0);
  };
  const readPropulsion = () => {
    if (!readShip()) return { available: false };
    const warpDriveActive = Boolean(state.warpDriveActive);
    return {
      available: true,
      authority: state.propulsionAuthority || 'bridge',
      speed: state.speed,
      speedUnit: 'm/s',
      warpSpeedC: Number(state.warpSpeedC) || 0,
      warpSafetyLock: Boolean(state.warpSafetyLock),
      maneuver: { ...(state.maneuver || {}) },
      maneuveringAssist: state.maneuveringAssist !== false,
      fuel: state.fuel,
      refinedDilithium: state.refinedDilithium,
      warpDriveActive,
      warpStage: state.warpCurrentStage || 0,
      selectedWarpStage: state.warpStage || 5,
      warpTargetSpeed: state.warpTargetSpeed || 0,
      warpTransition: state.warpTransition || 'idle',
      warpExitMode: state.warpExitMode || 'smooth',
      warpShutdownReason: state.warpShutdownReason || null,
      throttle: Boolean(state.throttle),
      braking: Boolean(state.braking),
      propulsionMode: warpDriveActive ? 'warp-cruise' : state.throttle ? 'conventional' : 'idle'
    };
  };
  const applyPropulsionInput = ({ control, active } = {}) => {
    if (!PROPULSION_INPUTS.has(control) || typeof active !== 'boolean') return { accepted: false, reason: 'invalid-propulsion-input' };
    if (!readShip()) return { accepted: false, reason: 'ship-unavailable' };
    if (control === 'warpDriveButton' && active) {
      const integrated = Boolean(state.warpCorePowerBusConnected);
      const hasWarpResource = integrated
        ? Number(state.plasma) > 0 || Number(state.warpCoreWarpBuffer) > 0
        : Number(state.refinedDilithium) > 0;
      if (!hasWarpResource) return { accepted: false, reason: integrated ? 'plasma-unavailable' : 'dilithium-unavailable' };
    }
    if (control.startsWith('maneuver')) {
      const direction = control.slice('maneuver'.length).toLowerCase();
      state.maneuver ||= { left: false, right: false, up: false, down: false };
      state.maneuver[direction] = active;
    } else {
      state[control] = active;
    }
    if (control === 'warpDriveButton' && active) state.warpStage = 5;
    return { accepted: true, control, active, authority: state.propulsionAuthority };
  };
  const resetPropulsionInputs = () => {
    // A dobra é um modo travado, não uma entrada momentânea como acelerador/freio.
    state.throttle = false;
    state.braking = false;
    state.maneuver = { left: false, right: false, up: false, down: false };
  };
  const requireEngineering = context => context?.terminalId === 'engineering-console';

  if (planetaryTransportCore) {
    computer.registerSystem('planetary-transport', {
      name: 'Transporte planetário · AURORA OS',
      commands: {
        status: () => planetaryTransportCore.getStatus(),
        search: payload => planetaryTransportCore.findDestinations(payload?.query || ''),
        registerCoordinate: (payload, context) => {
          if (context?.terminalId !== 'planetary-transport-console') return { accepted: false, reason: 'transport-terminal-required' };
          if (payload?.source !== 'surface-map-pick') return { accepted: false, reason: 'destination-must-be-picked-on-earth-surface' };
          try {
            const destination = planetaryTransportCore.registerDestination({
              id: payload?.id, name: payload?.name, bodyId: 'earth',
              latitudeDeg: payload?.latitudeDeg, longitudeDeg: payload?.longitudeDeg,
              elevationMeters: payload?.elevationMeters ?? 0, tags: ['surface-map-pick', 'earth']
            });
            const preview = planetaryTransportCore.previewDestination(destination.id, { altitudeOffsetMeters: 2.2 });
            if (!preview.ok) {
              planetaryTransportCore.unregisterDestination(destination.id);
              return { accepted: false, reason: preview.reason, message: preview.message || 'A coordenada não possui uma superfície terrestre resolvível.' };
            }
            return destination;
          } catch (error) {
            return { accepted: false, reason: 'invalid-coordinate', message: String(error?.message || error) };
          }
        },
        teleport: (payload, context) => {
          if (context?.terminalId !== 'planetary-transport-console') return { ok: false, reason: 'transport-terminal-required' };
          return planetaryTransportCore.teleport(payload?.destinationId, {
            actor: 'character', altitudeOffsetMeters: payload?.altitudeOffsetMeters ?? 2.2
          });
        },
        returnToShip: (_payload, context) => {
          if (context?.terminalId !== 'terrestrial-transport-console') {
            return { ok: false, reason: 'terrestrial-terminal-required' };
          }
          if (typeof getShipTransporterPosition !== 'function') {
            return { ok: false, reason: 'ship-return-position-unavailable' };
          }
          const target = getShipTransporterPosition();
          if (!target?.position) return { ok: false, reason: 'ship-return-position-unavailable' };
          return planetaryTransportCore.transferToPosition({
            id: 'ship-deck-2',
            name: 'Plataforma de transporte · Deck 2',
            position: target.position,
            normal: target.normal
          }, { actor: 'character' });
        }
      },
      getStatus: () => planetaryTransportCore.getStatus().state
    });
  }

  computer.registerSystem('navigation', {
    name: 'Navegação',
    commands: { telemetry: readNavigation },
    getStatus: () => readShip() ? 'online' : 'standby'
  });
  computer.registerSystem('sensors', {
    name: 'Sensores',
    commands: {
      scan: () => {
        const ship = readShip();
        if (!ship || typeof ship.position.distanceTo !== 'function') return { available: false, totalContacts: 0, nearestContact: null, contacts: [] };
        const asteroids = getAsteroids();
        const contacts = (Array.isArray(asteroids) ? asteroids : [])
          .filter(asteroid => asteroid?.position)
          .map((asteroid, index) => ({
            id: asteroid.name || asteroid.userData?.entityId || `asteroid-${index + 1}`,
            distance: ship.position.distanceTo(asteroid.position),
            ore: asteroid.userData?.ore ?? null,
            resources: Object.entries(asteroid.userData?.resources ?? {})
              .filter(([, deposit]) => Number(deposit?.amount) > 0)
              .map(([resourceId, deposit]) => ({
                resourceId,
                amount: Number(deposit.amount),
                purity: Number.isFinite(Number(deposit.purity)) ? Number(deposit.purity) : null
              })),
            resourceIds: Object.keys(asteroid.userData?.resources ?? {})
              .filter(resourceId => Number(asteroid.userData.resources[resourceId]?.amount) > 0)
          }))
          .sort((a, b) => a.distance - b.distance);
        return {
          available: true,
          totalContacts: contacts.length,
          resourceIds: [...new Set(contacts.flatMap(contact => contact.resourceIds))],
          resourceCatalog: [RESOURCE_IDS.DILITHIUM_ORE],
          nearestContact: contacts[0] || null,
          contacts
        };
      }
    },
    getStatus: () => readShip() ? 'online' : 'standby'
  });
  computer.registerSystem('power', {
    name: 'Energia e recursos',
    commands: {
      status: () => {
        const propulsion = readPropulsion();
        if (!propulsion.available) return { available: false };
        const integrated = Boolean(state.warpCorePowerBusConnected);
        const plasmaAmount = integrated ? Math.max(0, Number(state.plasma) || 0) : Math.max(0, Number(state.refinedDilithium) || 0);
        const deflectorSnapshot = deflectorRuntime?.snapshot?.() || null;
        const deflectorPower = deflectorSnapshot ? {
          available: true,
          enabled: Boolean(deflectorSnapshot.enabled),
          chargingEnabled: Boolean(deflectorSnapshot.chargingEnabled),
          storedEnergy: Math.max(0, Number(deflectorSnapshot.energy) || 0),
          capacity: Math.max(0, Number(deflectorSnapshot.capacity) || 0),
          transferRate: Math.max(0, Number(deflectorSnapshot.transferRate) || 0),
          consumptionRate: Math.max(0, Number(deflectorSnapshot.consumptionRate) || 0),
          consumedTotal: Math.max(0, Number(deflectorSnapshot.consumedTotal) || 0),
          transferredTotal: Math.max(0, Number(deflectorSnapshot.transferredTotal) || 0),
          powerBusConnected: Boolean(deflectorSnapshot.powerBusConnected),
          branches: (Array.isArray(deflectorSnapshot.branches) ? deflectorSnapshot.branches : []).map(branch => ({
            id: branch.id,
            name: branch.name,
            enabled: Boolean(branch.enabled),
            available: Boolean(branch.available),
            consumptionRate: Math.max(0, Number(branch.consumptionRate) || 0),
            consumedTotal: Math.max(0, Number(branch.consumedTotal) || 0)
          }))
        } : { available: false };
        return {
          available: true,
          deflectorPower,
          ...(!integrated ? { conventionalFuel: state.fuel, refinedDilithium: state.refinedDilithium } : {}),
          personalRawDilithiumOre: readPersonalRawOre(),
          matrixDilithiumFeedstock: Math.max(0, Number(state.refinedDilithium) || 0),
          plasma: { amount: plasmaAmount, capacity: integrated ? Math.max(0, Number(state.plasmaCapacity) || 0) : Number(refinerySystem?.snapshot?.().coreCapacity) || 250, consumedTotal: integrated ? Math.max(0, Number(state.plasmaConsumedTotal) || 0) : Math.max(0, Number(state.warpDilithiumConsumedTotal) || 0), consumptionRate: integrated ? Math.max(0, Number(state.warpCorePlasmaConsumptionRate) || 0) : state.warpDriveActive ? (WARP_DILITHIUM_CONSUMPTION[Number(state.warpCurrentStage) || 0] || 0) : 0 },
          warpCorePower: state.warpCorePowerTelemetry || null,
          warpCore: {
            resourceId: integrated ? 'resource.plasma' : RESOURCE_IDS.REFINED_DILITHIUM,
            reserve: plasmaAmount,
            capacity: integrated ? Math.max(0, Number(state.plasmaCapacity) || 0) : Number(refinerySystem?.snapshot?.().coreCapacity) || 250,
            active: Boolean(state.warpDriveActive),
            stage: Number(state.warpCurrentStage) || 0,
            consumptionRate: integrated ? Math.max(0, Number(state.warpCorePlasmaConsumptionRate) || 0) : state.warpDriveActive ? (WARP_DILITHIUM_CONSUMPTION[Number(state.warpCurrentStage) || 0] || 0) : 0,
            consumedTotal: integrated ? Math.max(0, Number(state.plasmaConsumedTotal) || 0) : Math.max(0, Number(state.warpDilithiumConsumedTotal) || 0),
            conventionalThrottleActive: Boolean(state.throttle),
            conventionalFuelConsumptionRate: state.throttle && Number(state.fuel) > 0 ? 0.28 : 0
          },
          refinery: refinerySystem?.snapshot?.() ?? { available: false },
          shields: shieldSystem?.snapshot?.() ?? { shield: state.shield, enabled: state.shieldEnabled !== false },
          shieldEnabled: state.shieldEnabled !== false,
          hull: state.hull,
          propulsionAuthority: propulsion.authority,
          warpDriveActive: propulsion.warpDriveActive,
          warpStage: propulsion.warpStage,
          warpTransition: propulsion.warpTransition
        };
      },
      transferRefinedDilithium: (payload, context) => {
        if (context?.terminalId !== 'ship-management-terminal') return { accepted: false, reason: 'management-terminal-required' };
        if (!readShip()) return { accepted: false, reason: 'ship-unavailable' };
        if (typeof refinerySystem?.transferToCore !== 'function') return { accepted: false, reason: 'refinery-transfer-unavailable' };
        return refinerySystem.transferToCore(payload?.amount);
      }
    },
    getStatus: () => readShip() ? 'monitoring' : 'standby'
  });
  computer.registerSystem('shields', {
    name: 'Escudos defletores',
    commands: {
      status: () => shieldSystem?.snapshot?.() ?? {
        enabled: state.shieldEnabled !== false, shield: state.shield, hull: state.hull
      },
      setEnabled: (payload, context) => {
        if (!['engineering-console','ship-management-terminal','pilot-console'].includes(context?.terminalId)) {
          return { accepted: false, reason: 'ship-computer-terminal-required' };
        }
        const status = shieldSystem?.setEnabled?.(Boolean(payload?.enabled));
        return { accepted: Boolean(status), status };
      }
    },
    getStatus: () => readShip() ? 'online' : 'standby'
  });
  computer.registerSystem('refinery', {
    name: 'Refinaria de dilítio',
    commands: {
      status: () => refinerySystem?.snapshot?.() ?? { available: false },
      setRefineryEnabled: (payload, context) => context?.terminalId !== 'refinery-console' ? { accepted: false, reason: 'refinery-terminal-required' } : { accepted: true, status: refinerySystem?.setRefineryEnabled?.(Boolean(payload?.enabled)) },
      setTransferEnabled: (payload, context) => context?.terminalId !== 'refinery-console' ? { accepted: false, reason: 'refinery-terminal-required' } : { accepted: true, status: refinerySystem?.setTransferEnabled?.(Boolean(payload?.enabled)) }
    },
    getStatus: () => readShip() ? (refinerySystem?.snapshot?.().refineryEnabled ? 'online' : 'offline') : 'standby'
  });
  computer.registerSystem('propulsion', {
    name: 'Propulsão',
    commands: {
      status: readPropulsion,
      setPilotInput: (payload, context) => {
        if (context.terminalId !== 'pilot-console') return { accepted: false, reason: 'pilot-terminal-required' };
        const authority = state.propulsionAuthority || 'bridge';
        // Um comando físico no console do piloto é uma retomada explícita do leme.
        // A Engenharia pode reassumir o controle a qualquer momento pelo seu console.
        if (authority === 'engineering' || authority === 'automatic') {
          state.propulsionAuthority = 'bridge';
        }
        return applyPropulsionInput(payload);
      },
      setWarpStage: (payload, context) => {
        if (context.terminalId !== 'pilot-console') return { accepted: false, reason: 'pilot-terminal-required' };
        const stage = Math.round(Number(payload?.stage));
        if (!Number.isInteger(stage) || stage < 1 || stage > 5) return { accepted: false, reason: 'invalid-warp-stage' };
        if (!state.warpDriveActive) return { accepted: false, reason: 'warp-not-active' };
        state.warpStage = stage;
        return { accepted: true, stage, targetSpeed: WARP_STAGE_SPEEDS[stage] };
      }
    },
    getStatus: () => readShip() ? 'online' : 'standby'
  });
  computer.registerSystem('engineering', {
    name: 'Engenharia e propulsão de dobra',
    commands: {
      status: (payload, context) => ({
        ...readPropulsion(),
        warpCore: 'connected-to-ship-computer',
        warpField: 'five-stage-cruise'
      }),
      setAuthority: (payload, context) => {
        if (!requireEngineering(context)) return { accepted: false, reason: 'engineering-terminal-required' };
        const mode = payload?.mode;
        if (!CONTROL_AUTHORITIES.has(mode)) return { accepted: false, reason: 'invalid-authority' };
        resetPropulsionInputs();
        state.propulsionAuthority = mode;
        return { accepted: true, authority: mode };
      },
      setInput: (payload, context) => {
        if (!requireEngineering(context)) return { accepted: false, reason: 'engineering-terminal-required' };
        if (state.propulsionAuthority !== 'engineering') return { accepted: false, reason: 'engineering-authority-not-active' };
        return applyPropulsionInput(payload);
      },
      setWarpActive: (payload, context) => {
        if (!requireEngineering(context)) return { accepted: false, reason: 'engineering-terminal-required' };
        return applyPropulsionInput({ control: 'warpDriveButton', active: Boolean(payload?.active) });
      },
      setWarpStage: (payload, context) => {
        if (!requireEngineering(context)) return { accepted: false, reason: 'engineering-terminal-required' };
        const stage = Math.round(Number(payload?.stage));
        if (!Number.isInteger(stage) || stage < 1 || stage > 5) return { accepted: false, reason: 'invalid-warp-stage' };
        state.warpStage = stage;
        return { accepted: true, stage, targetSpeed: WARP_STAGE_SPEEDS[stage], speedUnit: 'c' };
      },
      setWarpExitMode: (payload, context) => {
        if (!requireEngineering(context)) return { accepted: false, reason: 'engineering-terminal-required' };
        const mode = payload?.mode;
        if (!WARP_EXIT_MODES.has(mode)) return { accepted: false, reason: 'invalid-warp-exit-mode' };
        state.warpExitMode = mode;
        return { accepted: true, mode };
      }
    },
    getStatus: () => readShip() ? 'online' : 'standby'
  });
// A matriz é uma ramificação de controle do Ship Computer e reutiliza
  // a instância única do sistema de energia registrada no Runtime.
  computer.registerSystem('matrix', {
    name: 'Matriz de dilítio e distribuição EPS',
    commands: {
      status: () => ({
        available: Boolean(readShip() && warpCoreSystem),
        power: warpCoreSystem?.snapshot?.() ?? state.warpCorePowerTelemetry ?? null,
        warpDriveActive: Boolean(state.warpDriveActive),
        warpTransition: state.warpTransition || 'idle'
      }),
      setEnabled: (payload, context) => {
        if (context?.terminalId !== DILITHIUM_MATRIX_TERMINAL_ID) return { accepted: false, reason: 'matrix-terminal-required' };
        const enabled = Boolean(payload?.enabled);
        const unsafeWarp = Boolean(state.warpDriveActive) || ['entering', 'cruise', 'reducing', 'exiting'].includes(state.warpTransition);
        if (!enabled && unsafeWarp) return { accepted: false, reason: 'warp-interlock-active' };
        if (enabled && (!state.warpCoreEnabled || !state.warpCoreContainmentStable)) return { accepted: false, reason: 'core-or-containment-unavailable' };
        if (typeof warpCoreSystem?.setMatrixEnabled !== 'function') return { accepted: false, reason: 'matrix-system-unavailable' };
        return { accepted: true, status: warpCoreSystem.setMatrixEnabled(enabled) };
      },
      setRegulation: (payload, context) => {
        if (context?.terminalId !== 'dilithium-matrix-console') return { accepted: false, reason: 'matrix-terminal-required' };
        const regulation = Number(payload?.regulation);
        if (!Number.isFinite(regulation) || regulation < 0.1 || regulation > 1) return { accepted: false, reason: 'regulation-out-of-range' };
        if (typeof warpCoreSystem?.setMatrixRegulation !== 'function') return { accepted: false, reason: 'matrix-system-unavailable' };
        return { accepted: true, status: warpCoreSystem.setMatrixRegulation(regulation) };
      }
    },
    getStatus: () => readShip() && warpCoreSystem ? (state.warpCoreMatrixEnabled === false ? 'standby' : 'online') : 'standby'
  });
  computer.registerSystem('deflector', {
    name: 'Defletor principal',
    commands: {
      status: (payload, context) => {
        if (!['deflector-console', DILITHIUM_MATRIX_TERMINAL_ID, 'ship-management-terminal'].includes(context?.terminalId)) return { available: false, reason: 'deflector-terminal-required' };
        if (!deflectorRuntime) return { available: false, reason: 'deflector-runtime-unavailable' };
        const snapshot = deflectorRuntime.snapshot?.() || {};
        const { emitter, sensors, navigation, protection, science, ...core } = snapshot;
        return { available: true, core, emitter: emitter || {}, sensors: sensors || {}, navigation: navigation || {}, protection: protection || {}, science: science || {} };
      },
      setCoreEnabled: (payload, context) => {
        if (context?.terminalId !== 'deflector-console') return { accepted: false, reason: 'deflector-terminal-required' };
        return { accepted: true, status: deflectorRuntime?.setCoreEnabled?.(Boolean(payload?.enabled)) };
      },
      setChargingEnabled: (payload, context) => {
        if (context?.terminalId !== 'deflector-console') return { accepted: false, reason: 'deflector-terminal-required' };
        return { accepted: true, status: deflectorRuntime?.setChargingEnabled?.(Boolean(payload?.enabled)) };
      },
      setEmitterEnabled: (payload, context) => {
        if (context?.terminalId !== 'deflector-console') return { accepted: false, reason: 'deflector-terminal-required' };
        return { accepted: true, status: deflectorRuntime?.setEmitterEnabled?.(Boolean(payload?.enabled)) };
      },
      setSensorsEnabled: (payload, context) => {
        if (context?.terminalId !== 'deflector-console') return { accepted: false, reason: 'deflector-terminal-required' };
        return { accepted: true, status: deflectorRuntime?.setSensorsEnabled?.(Boolean(payload?.enabled)) };
      },
      setNavigationEnabled: (payload, context) => {
        if (context?.terminalId !== 'deflector-console') return { accepted: false, reason: 'deflector-terminal-required' };
        return { accepted: true, status: deflectorRuntime?.setNavigationEnabled?.(Boolean(payload?.enabled)) };
      },
      setProtectionEnabled: (payload, context) => {
        if (context?.terminalId !== 'deflector-console') return { accepted: false, reason: 'deflector-terminal-required' };
        return { accepted: true, status: deflectorRuntime?.setProtectionEnabled?.(Boolean(payload?.enabled)) };
      },
      setScienceEnabled: (payload, context) => {
        if (context?.terminalId !== 'deflector-console') return { accepted: false, reason: 'deflector-terminal-required' };
        return { accepted: true, status: deflectorRuntime?.setScienceEnabled?.(Boolean(payload?.enabled)) };
      },
      setScienceMode: (payload, context) => {
        if (context?.terminalId !== 'deflector-console') return { accepted: false, reason: 'deflector-terminal-required' };
        return { accepted: true, status: deflectorRuntime?.setScienceMode?.(payload?.mode) };
      }
    },
    getStatus: () => deflectorRuntime ? 'online' : 'standby'
  });
  return true;
}
