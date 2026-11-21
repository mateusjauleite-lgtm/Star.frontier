import { EntityManager } from '../../entities/EntityManager.js';
import { createEntityRuntimeSystem } from './entitySystem.js';
import { createCharacterRuntimeSystem } from './characterSystem.js';
import { createWorldRuntimeSystem } from './worldSystem.js';
import { createShipComputerRuntimeSystem } from './shipComputerSystem.js';
import { createShipManagementTerminalRuntimeSystem } from '../../../ships/computer/managementTerminal/managementTerminalController.js';
import { createEngineeringTerminalRuntimeSystem } from '../../../ships/computer/engineeringTerminalController.js';
import { createPauseMenuRuntimeSystem } from './pauseMenuSystem.js';
import { createOrbitalPhysicsRuntimeSystem } from './orbitalPhysicsSystem.js';
import { createGameplayRuntimeSystem } from './gameplaySystem.js';

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
    mining,
    pauseMenu,
    orbitalPhysics,
    gameplay
  } = dependencies;

  runtime.registerSystem('entity-manager', createEntityRuntimeSystem({ manager: entityManager }));
  runtime.registerSystem('character', createCharacterRuntimeSystem(character));
  runtime.registerSystem('world', createWorldRuntimeSystem(world));
  runtime.registerSystem('ship-computer', createShipComputerRuntimeSystem(shipComputer));
  if (shipManagementTerminal) {
    runtime.registerSystem('ship-management-terminal', createShipManagementTerminalRuntimeSystem(shipManagementTerminal));
  }
  if (engineeringTerminal) {
    runtime.registerSystem('engineering-terminal', createEngineeringTerminalRuntimeSystem(engineeringTerminal));
  }
  if (mining) runtime.registerSystem('mining', mining);
  if (pauseMenu) runtime.registerSystem('pause-menu', createPauseMenuRuntimeSystem({ ...pauseMenu, runtime }));
  runtime.registerSystem('gameplay', createGameplayRuntimeSystem(gameplay));
  runtime.registerSystem('orbital-physics', createOrbitalPhysicsRuntimeSystem(orbitalPhysics));

  return runtime;
}
