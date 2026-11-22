// Recorte provisório da abertura frontal do defletor principal no Deck 3.
// A geometria do emissor será construída depois da validação visual do recorte.
// Coordenadas locais da nave; Z negativo aponta para a proa.
export const DECK_3_DEFLECTOR_APERTURE = Object.freeze({
  centerX: 0,
  centerY: -2.9,
  centerZ: -45,
  radiusX: 8.5,
  radiusY: 3.6,
  radiusZ: 7.5
});

// Recebe o centroide de um triângulo da concha inferior em coordenadas
// normalizadas da esfera e testa se ele pertence à abertura elipsoidal.
export function isInsideDeck3DeflectorAperture(normalizedX, normalizedY, normalizedZ) {
  const x = normalizedX * 27.2;
  const y = normalizedY * 15.2;
  const z = normalizedZ * 50;
  const aperture = DECK_3_DEFLECTOR_APERTURE;

  const dx = (x - aperture.centerX) / aperture.radiusX;
  const dy = (y - aperture.centerY) / aperture.radiusY;
  const dz = (z - aperture.centerZ) / aperture.radiusZ;

  return dx * dx + dy * dy + dz * dz < 1;
}
