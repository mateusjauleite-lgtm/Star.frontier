import { EntityManager } from '../../entities/EntityManager.js';
import { state } from '../../state.js';
import { saveState } from '../../storage.js';
import { createEntityRuntimeSystem } from './entitySystem.js';
import { createCharacterRuntimeSystem } from './characterSystem.js';
import { createWorldRuntimeSystem } from './worldSystem.js';
import { createShipComputerRuntimeSystem } from './shipComputerSystem.js';
import { createShipManagementTerminalRuntimeSystem } from '../../../ships/computer/managementTerminal/managementTerminalController.js';
import { createEngineeringTerminalRuntimeSystem } from '../../../ships/computer/engineeringTerminalController.js';
import { createPauseMenuRuntimeSystem } from './pauseMenuSystem.js';
import { createOrbitalPhysicsRuntimeSystem } from './orbitalPhysicsSystem.js';
import { createGameplayRuntimeSystem } from './gameplaySystem.js';
import { createDeflectorRuntimeSystem } from '../../../ships/systems/deflectorRuntimeSystem.js';
import { createWarpCorePowerSystem } from '../../../ships/systems/warpCorePowerSystem.js';
import { createDilithiumRefineryRuntimeSystem } from '../../../ships/systems/dilithiumRefinerySystem.js';
import { createRefineryTerminalRuntimeSystem } from '../../../ships/computer/refineryTerminalController.js';

export function registerGameRuntimeSystems(runtime, dependencies) {
  if (!runtime || typeof runtime.registerSystem !== 'function') {
    throw new TypeError('O Runtime não está disponível para registrar os sistemas.');
  }

  const {
    entityManager = new EntityManager(),
    character,
    world,
    shipComputer,
    shipManagementTerminal,
    engineeringTerminal,
    refineryTerminal,
    refinery,
    mining,
    pauseMenu,
    orbitalPhysics,
    gameplay,
    warpCore: suppliedWarpCore,
    deflector: suppliedDeflector
  } = dependencies;
  const warpCore = suppliedWarpCore || createWarpCorePowerSystem({ state, persist: saveState });
  const deflector = suppliedDeflector || createDeflectorRuntimeSystem({
    state, persist: saveState, powerBus: warpCore.powerBus
  });

  runtime.registerSystem('entity-manager', createEntityRuntimeSystem({ manager: entityManager }));
  runtime.registerSystem('character', createCharacterRuntimeSystem(character));
  runtime.registerSystem('world', createWorldRuntimeSystem(world));
  runtime.registerSystem('ship-computer', createShipComputerRuntimeSystem(shipComputer));
  if (shipManagementTerminal) {
    runtime.registerSystem('ship-management-terminal', createShipManagementTerminalRuntimeSystem(shipManagementTerminal));
  }
  if (engineeringTerminal) runtime.registerSystem('engineering-terminal', createEngineeringTerminalRuntimeSystem(engineeringTerminal));
  if (refineryTerminal) runtime.registerSystem('refinery-terminal', createRefineryTerminalRuntimeSystem(refineryTerminal));
  if (mining) runtime.registerSystem('mining', mining);
  if (pauseMenu) runtime.registerSystem('pause-menu', createPauseMenuRuntimeSystem({ ...pauseMenu, runtime }));
  if (warpCore) runtime.registerSystem('warp-core-power', warpCore);
  runtime.registerSystem('gameplay', createGameplayRuntimeSystem(gameplay));
  if (deflector) runtime.registerSystem('deflector-core', deflector);
  if (refinery) runtime.registerSystem('dilithium-refinery', createDilithiumRefineryRuntimeSystem(refinery));
  runtime.registerSystem('orbital-physics', createOrbitalPhysicsRuntimeSystem(orbitalPhysics));

  return runtime;
}
