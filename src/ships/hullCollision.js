// Colisão da Aurora-7 derivada da concha elipsoidal real do casco.
// Medidas extraídas de Upper-Saucer-Hull e Lower-Saucer-Hull em exploration.js.
export const AURORA_HULL_DIMENSIONS = Object.freeze({
  radiusX: 27.2,
  radiusY: 15.2,
  radiusZ: 50
});

const DECK_3_DEFLECTOR_OPENING = Object.freeze({
  centerX: 0,
  centerY: -2.9,
  centerZ: -45,
  radiusX: 11.2,
  radiusY: 5.2,
  radiusZ: 10
});

// Testa se o centro do corpo do personagem permanece dentro do casco.
// feetY deve ser a altura real do piso naquele ponto (inclui plataformas).
// O raio é descontado da concha para que o capsule do personagem não atravesse
// a superfície visual mesmo quando seu centro ainda está ligeiramente dentro.
export function isCharacterInsideAuroraHull(
  position,
  deckId,
  feetY,
  { height = 1.8, radius = 0.48 } = {}
) {
  if (
    !position ||
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.z) ||
    !Number.isFinite(feetY) ||
    !Number.isFinite(height) ||
    !Number.isFinite(radius) ||
    height <= 0 ||
    radius < 0 ||
    !['D1', 'D2', 'D3', 'D4'].includes(deckId)
  ) return false;

  const centerY = feetY + height * 0.5;
  if (!Number.isFinite(centerY)) return false;
  // Considera a extremidade da cápsula mais próxima da concha: topo nos
  // decks superiores e sola nos inferiores. Isso evita atravessar o casco
  // com a cabeça durante saltos ou com os pés junto à borda inferior.

  // O casco superior fecha D1/D2; a concha inferior fecha D3/D4.
  if ((deckId === 'D1' || deckId === 'D2') && centerY <= 0) return false;
  if ((deckId === 'D3' || deckId === 'D4') && centerY >= 0) return false;

  // A abertura elipsoidal do defletor é um recorte real na concha inferior.
  if (deckId === 'D3') {
    const opening = DECK_3_DEFLECTOR_OPENING;
    const rx = opening.radiusX - radius;
    const ry = opening.radiusY - radius;
    const rz = opening.radiusZ - radius;
    if (rx > 0 && ry > 0 && rz > 0) {
      const dx = (position.x - opening.centerX) / rx;
      const dy = (centerY - opening.centerY) / ry;
      const dz = (position.z - opening.centerZ) / rz;
      if (dx * dx + dy * dy + dz * dz <= 1) return true;
    }
  }

  // O hangar do D4 tem um túnel aberto no casco inferior até a popa.
  // Os limites reproduzem o recorte aplicado à malha em exploration.js.
  if (
    deckId === 'D4' &&
    Math.abs(position.x) <= 9.792 - radius &&
    position.z >= 30 + radius &&
    centerY >= -11.552 + radius &&
    centerY <= -2.736 - radius
  ) return true;

  const rx = AURORA_HULL_DIMENSIONS.radiusX - radius;
  // A altura do casco não é reduzida: a cápsula é centrada verticalmente,
  // enquanto o raio horizontal é compensado nos eixos X/Z.
  const ry = AURORA_HULL_DIMENSIONS.radiusY;
  const rz = AURORA_HULL_DIMENSIONS.radiusZ - radius;
  if (rx <= 0 || ry <= 0 || rz <= 0) return false;

  const shellContactY = deckId === 'D1' || deckId === 'D2'
    ? feetY + height - radius
    : feetY + radius;
  const normalizedX = position.x / rx;
  const normalizedY = shellContactY / ry;
  const normalizedZ = position.z / rz;
  return normalizedX ** 2 + normalizedY ** 2 + normalizedZ ** 2 <= 1;
}
