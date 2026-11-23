import { EARTH_MEAN_RADIUS_METERS } from './physicalScale.js';

// A unidade visual passa a representar um quilómetro: a nave mantém a geometria
// original enquanto a Terra e os referenciais espaciais usam a escala SI central.
export const LEGACY_EARTH_RENDER_RADIUS_UNITS = 600;
export const EARTH_RENDER_RADIUS_UNITS = EARTH_MEAN_RADIUS_METERS / 1000;
export const EARTH_WORLD_SCALE_FACTOR =
  EARTH_RENDER_RADIUS_UNITS / LEGACY_EARTH_RENDER_RADIUS_UNITS;

export const EARTH_WORLD_CENTER = Object.freeze([
  0,
  0,
  -850 * EARTH_WORLD_SCALE_FACTOR
]);

export const EARTH_ORBIT_RADIUS_UNITS = 960 * EARTH_WORLD_SCALE_FACTOR;

// A estação mantém a posição relativa histórica à Terra, em vez de ficar
// artificialmente próxima da nave após o aumento do raio planetário.
export const STATION_WORLD_POSITION = Object.freeze([
  24 * EARTH_WORLD_SCALE_FACTOR,
  3 * EARTH_WORLD_SCALE_FACTOR,
  EARTH_WORLD_CENTER[2] + 785 * EARTH_WORLD_SCALE_FACTOR
]);

// O cinturão fica a 3,4 raios terrestres do centro. Mesmo no limite interno
// do volume aleatório, permanece próximo de três raios distante da Terra.
export const ASTEROID_FIELD_CENTER = Object.freeze([
  EARTH_RENDER_RADIUS_UNITS * 3.4,
  0,
  EARTH_WORLD_CENTER[2]
]);
export const ASTEROID_FIELD_SPREAD = Object.freeze([3600, 1800, 3600]);
const ASTEROID_FIELD_HALF_DIAGONAL = Math.hypot(
  ASTEROID_FIELD_SPREAD[0] / 2,
  ASTEROID_FIELD_SPREAD[1] / 2,
  ASTEROID_FIELD_SPREAD[2] / 2
);
export const ASTEROID_FIELD_MIN_DISTANCE_UNITS =
  EARTH_RENDER_RADIUS_UNITS * 3.4 - ASTEROID_FIELD_HALF_DIAGONAL;
