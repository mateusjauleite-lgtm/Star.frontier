import { navigationModule } from './navigation/index.js';
import { tacticalModule } from './tactical/index.js';
import { weaponsModule } from './weapons/index.js';
import { engineeringModule } from './engineering/index.js';
import { defenseModule } from './defense/index.js';
import { diagnosticsModule } from './diagnostics/index.js';
import { warpCoreModule } from './warpCore/index.js';

export const SHIP_COMPUTER_MODULES = Object.freeze([
  navigationModule,
  tacticalModule,
  weaponsModule,
  engineeringModule,
  warpCoreModule,
  defenseModule,
  diagnosticsModule
]);

export function getShipComputerModule(id) {
  return SHIP_COMPUTER_MODULES.find(module => module.id === id) ?? null;
}
