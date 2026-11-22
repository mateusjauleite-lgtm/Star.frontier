import { chemicalElements } from './modules/chemicalElements/catalog.js';
import { mineralsCrystals } from './modules/mineralsCrystals/catalog.js';
import { metalsAlloys } from './modules/metalsAlloys/catalog.js';
import { gasesCompounds } from './modules/gasesCompounds/catalog.js';
import { isotopesParticles } from './modules/isotopesParticles/catalog.js';
export const matterElementsCatalog = Object.freeze([...chemicalElements,...mineralsCrystals,...metalsAlloys,...gasesCompounds,...isotopesParticles]);