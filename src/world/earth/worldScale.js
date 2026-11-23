import { EARTH_MEAN_RADIUS_METERS } from './physicalScale.js';

// Um render unit equivale a um metro. Assim o casco da nave e as estruturas
// métricas existentes mantêm sua dimensão física sem qualquer escala no modelo.
export const LEGACY_EARTH_RENDER_RADIUS_UNITS = 600;
export const EARTH_RENDER_RADIUS_UNITS = EARTH_MEAN_RADIUS_METERS;
export const EARTH_WORLD_SCALE_FACTOR =
  EARTH_RENDER_RADIUS_UNITS / LEGACY_EARTH_RENDER_RADIUS_UNITS;

export const EARTH_WORLD_CENTER = Object.freeze([
  0,
  0,
  -850 * EARTH_WORLD_SCALE_FACTOR
]);

export const EARTH_ORBIT_RADIUS_UNITS = 960 * EARTH_WORLD_SCALE_FACTOR;

// A estação mantém a posição relativa histórica em relação à Terra.
export const STATION_WORLD_POSITION = Object.freeze([
  24 * EARTH_WORLD_SCALE_FACTOR,
  3 * EARTH_WORLD_SCALE_FACTOR,
  EARTH_WORLD_CENTER[2] + 785 * EARTH_WORLD_SCALE_FACTOR
]);

// O campo fica a 3,4 raios terrestres do centro. Sua extensão conserva a
// proporção do campo original, mas agora é expressa em metros.
export const ASTEROID_FIELD_CENTER = Object.freeze([
  EARTH_RENDER_RADIUS_UNITS * 3.4,
  0,
  EARTH_WORLD_CENTER[2]
]);
export const ASTEROID_FIELD_SPREAD = Object.freeze([
  190 * EARTH_WORLD_SCALE_FACTOR,
  100 * EARTH_WORLD_SCALE_FACTOR,
  160 * EARTH_WORLD_SCALE_FACTOR
]);
const ASTEROID_FIELD_HALF_DIAGONAL = Math.hypot(
  ASTEROID_FIELD_SPREAD[0] / 2,
  ASTEROID_FIELD_SPREAD[1] / 2,
  ASTEROID_FIELD_SPREAD[2] / 2
);
export const ASTEROID_FIELD_MIN_DISTANCE_UNITS =
  EARTH_RENDER_RADIUS_UNITS * 3.4 - ASTEROID_FIELD_HALF_DIAGONAL;
