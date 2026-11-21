import { WARP_STAGE_SPEEDS } from '../flight/flightDynamics.js';
// Adaptadores entre o computador central e os sistemas reais da nave.
// Ponte e Engenharia consultam e comandam a mesma fonte de estado.
const PROPULSION_INPUTS = new Set(['throttle', 'braking', 'warpDriveButton']);
const CONTROL_AUTHORITIES = new Set(['bridge', 'engineering', 'automatic']);
const WARP_EXIT_MODES = new Set(['smooth', 'direct']);

export function registerShipComputerSystems(computer, { state, getShip, getShipYaw, getPitchAngle, getAsteroids, getDilithiumProcessing = () => null }) {
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
  const readPropulsion = () => {
    if (!readShip()) return { available: false };
    const warpDriveActive = Boolean(state.warpDriveActive);
    return {
      available: true,
      authority: state.propulsionAuthority || 'bridge',
      speed: state.speed,
      fuel: state.fuel,
      refinedDilithium: state.refinedDilithium,
      warpCoreDilithium: state.warpCoreDilithium,
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
    if (control === 'warpDriveButton' && active && !(Number(state.warpCoreDilithium) > 0)) {
      return { accepted: false, reason: 'dilithium-unavailable' };
    }
    state[control] = active;
    if (control === 'warpDriveButton' && active) state.warpStage = 5;
    return { accepted: true, control, active, authority: state.propulsionAuthority };
  };
  const resetPropulsionInputs = () => {
    // A dobra é um modo travado, não uma entrada momentânea como acelerador/freio.
    state.throttle = false;
    state.braking = false;
  };
  const requireEngineering = context => context?.terminalId === 'engineering-console';

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
            id: asteroid.name || `asteroid-${index + 1}`,
            distance: ship.position.distanceTo(asteroid.position),
            ore: asteroid.userData?.ore ?? null
          }))
          .sort((a, b) => a.distance - b.distance);
        return { available: true, totalContacts: contacts.length, nearestContact: contacts[0] || null, contacts };
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
        return {
          available: true,
          conventionalFuel: state.fuel,
          refinedDilithium: state.refinedDilithium,
          warpCoreDilithium: state.warpCoreDilithium,
          shields: state.shield,
          hull: state.hull,
          propulsionAuthority: propulsion.authority,
          warpDriveActive: propulsion.warpDriveActive,
          warpStage: propulsion.warpStage,
          warpTransition: propulsion.warpTransition
        };
      }
    },
    getStatus: () => readShip() ? 'monitoring' : 'standby'
  });
  computer.registerSystem('propulsion', {
    name: 'Propulsão',
    commands: {
      status: readPropulsion,
      setPilotInput: (payload, context) => {
        if (context.terminalId !== 'pilot-console') return { accepted: false, reason: 'pilot-terminal-required' };
        const authority = state.propulsionAuthority || 'bridge';
        if (authority === 'engineering') return { accepted: false, reason: 'engineering-has-authority' };
        if (authority === 'automatic') state.propulsionAuthority = 'bridge';
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
      status: () => ({
        ...readPropulsion(),
        warpCore: 'connected-to-ship-computer',
        warpField: 'five-stage-cruise',
        dilithiumProcessing: getDilithiumProcessing()?.snapshot?.() ?? { available: false }
      }),
      setRefineryActive: (payload, context) => {
        if (!requireEngineering(context)) return { accepted: false, reason: 'engineering-terminal-required' };
        const system = getDilithiumProcessing();
        return system?.setRefineryActive?.(payload?.active) ?? { accepted: false, reason: 'processing-system-unavailable' };
      },
      transferDilithiumToCore: (payload, context) => {
        if (!requireEngineering(context)) return { accepted: false, reason: 'engineering-terminal-required' };
        const system = getDilithiumProcessing();
        return system?.transferToCore?.(payload ?? {}) ?? { accepted: false, reason: 'processing-system-unavailable' };
      },
      dilithiumStatus: (payload, context) => {
        if (!requireEngineering(context)) return { accepted: false, reason: 'engineering-terminal-required' };
        return getDilithiumProcessing()?.snapshot?.() ?? { available: false };
      },
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
        return { accepted: true, stage, targetSpeed: [0, 115, 155, 205, 270, 350][stage] };
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
  return true;
}
