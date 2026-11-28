// Estado compartilhado do Star Frontier.
// Os módulos importam esta mesma referência para manter os dados sincronizados.

export const state = {
  user: '',
  email: '',
  country: 'Brasil',
  credits: 1000,
  ore: 0,
  rawDilithiumOre: 0,
  refineryRefinedStorage: 0,
  refineryRawReceivedTotal: 0,
  dilithiumInventoryVersion: 0,
  refineryEnabled: true,
  refineryTransferEnabled: false,
  refineryRefinedTotal: 0,
  refineryTransferredTotal: 0,
  deflectorCoreEnergy: 0,
  deflectorCoreEnabled: true,
  deflectorCoreChargingEnabled: true,
  deflectorCoreTransferredTotal: 0,
  deflectorCoreConsumedTotal: 0,
  deflectorBranchConsumptionTotals: {},
  deflectorCoreTelemetry: null,
  warpCoreEnabled: true,
  warpCoreMatrixEnabled: true,
  warpCoreContainmentStable: true,
  warpCoreMatrixRegulation: 1,
  warpCoreCriticalBuffer: 0,
  warpCoreOperationsBuffer: 0,
  warpCoreWarpBuffer: 0,
  warpCoreGeneratedTotal: 0,
  warpCoreDeliveredTotal: 0,
  warpCorePowerBusConnected: false,
  fuel: 100,
  refinedDilithium: 100,
  warpDilithiumConsumedTotal: 0,
  cargo: 0,
  hull: 100,
  shield: 100,
  shieldEnabled: true,
  speed: 0, // velocidade convencional em m/s
  warpSpeedC: 0, // velocidade de dobra em múltiplos de c
  gravityVelocity: [0, 0, 0], // componente de velocidade mundial não longitudinal, em m/s
  conventionalSpeedLimit: 12000,
  warpSafetyLock: false,
  maneuveringAssist: true,
  auxiliaryThrustersActive: false,
  maneuver: { left: false, right: false, up: false, down: false },
  ship: 'Nave exploradora',
  character: 'Explorador',
  camera: 2,
  throttle: false,
  braking: false,
  landingAutopilotActive: false,
  landingAutopilotVelocityInitialized: false,
  landingAutopilotControlAccelerationWorld: null,
  warpDriveButton: false,
  warpDriveActive: false,
  warpStage: 5,
  warpCurrentStage: 0,
  warpTargetSpeed: 0,
  warpTransition: 'idle',
  warpExitMode: 'smooth',
  warpShutdownReason: null,
  propulsionAuthority: 'bridge',
  move: { x: 0, y: 0 },
  aim: { x: 0, y: 0 },
  view: { x: 0, y: 0 },
  miningDrill: 'Broca básica',
  inventory: {
    items: [],
    overflowItems: [],
    capacity: 24,
    maxWeight: 60,
    equipment: {
      suit: 'Traje de exploração básico',
      helmet: null,
      head: null,
      torso: null,
      gloves: null,
      hands: null,
      legs: null,
      boots: null,
      feet: null,
      back: null,
      weapon: null,
      tool: null,
      machine: null
    }
  },
  settings: {
    quality: 'Média',
    music: 40,
    effects: 70,
    sensitivity: 1,
    simulationTimeScale: 1
  }
};

// Controles momentâneos não devem continuar ativos após carregar um jogo.
export function resetTransientState() {
  state.move = { x: 0, y: 0 };
  state.aim = { x: 0, y: 0 };
  state.view = { x: 0, y: 0 };
  state.throttle = false;
  state.landingAutopilotActive = false;
  state.landingAutopilotVelocityInitialized = false;
  state.landingAutopilotControlAccelerationWorld = null;
  state.maneuver = { left: false, right: false, up: false, down: false };
  state.gravityVelocity = [0, 0, 0];
  state.warpSpeedC = 0;
  state.warpSafetyLock = false;
  state.auxiliaryThrustersActive = false;
  state.braking = false;
  state.warpDriveButton = false;
  state.warpCorePowerBusConnected = false;
  delete state.requestWarpPower;
  state.warpDriveActive = false;
  state.warpCurrentStage = 0;
  state.warpTargetSpeed = 0;
  state.warpTransition = 'idle';
  state.propulsionAuthority = 'bridge';
}
