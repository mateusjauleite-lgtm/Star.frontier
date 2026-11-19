import { createCharacterRuntimeSystem } from './characterSystem.js';
import { createWorldRuntimeSystem } from './worldSystem.js';
import { createShipComputerRuntimeSystem } from './shipComputerSystem.js';
import { createGameplayRuntimeSystem } from './gameplaySystem.js';

export function registerGameRuntimeSystems(runtime, dependencies) {
  if (!runtime || typeof runtime.registerSystem !== 'function') {
    throw new TypeError('O Runtime não está disponível para registrar os sistemas.');
  }

  const {
    character,
    world,
    shipComputer,
    gameplay
  } = dependencies;

  runtime.registerSystem('character', createCharacterRuntimeSystem(character));
  runtime.registerSystem('world', createWorldRuntimeSystem(world));
  runtime.registerSystem('ship-computer', createShipComputerRuntimeSystem(shipComputer));
  runtime.registerSystem('gameplay', createGameplayRuntimeSystem(gameplay.update));

  return runtime;
}
