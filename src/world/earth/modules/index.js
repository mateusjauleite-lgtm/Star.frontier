import { EARTH_SURFACE_MODULE } from './surface.js';
import { EARTH_TERRAIN_MODULE } from './terrain.js';
import { EARTH_OCEANS_MODULE } from './oceans.js';
import { EARTH_ATMOSPHERE_MODULE } from './atmosphere.js';
import { EARTH_CLOUDS_MODULE } from './clouds.js';
import { EARTH_LIGHTING_MODULE } from './lighting.js';

/** Dependency-safe initialization order for the six independent renderers. */
export const EARTH_UPDATE_MODULES = Object.freeze([
  EARTH_SURFACE_MODULE, EARTH_TERRAIN_MODULE, EARTH_OCEANS_MODULE,
  EARTH_ATMOSPHERE_MODULE, EARTH_CLOUDS_MODULE, EARTH_LIGHTING_MODULE
]);
