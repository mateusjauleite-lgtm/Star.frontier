import { createDeflectorGeometry } from './deflectorGeometry.js';
import { DECK_3_DEFLECTOR_APERTURE } from './deflectorAperture.js';
// Instala o conjunto visual na posição definida pelo recorte, sem alterar o casco.
export function createDeflectorAssembly(options = {}) {
  const assembly=createDeflectorGeometry(options);
  assembly.name='Frontier-Deck3-Primary-Deflector';
  assembly.position.set(DECK_3_DEFLECTOR_APERTURE.centerX,DECK_3_DEFLECTOR_APERTURE.centerY,DECK_3_DEFLECTOR_APERTURE.centerZ);
  assembly.rotation.y=Math.PI;
  // O prato é elíptico para caber no recorte real do casco sem atravessar a borda.
  const radius = Number(options.radius) > 0 ? Number(options.radius) : 8.5;
  assembly.scale.set(1, (DECK_3_DEFLECTOR_APERTURE.radiusY - 0.35) / (radius + 0.42), 1);
  assembly.userData.deck='D3';
  assembly.userData.aperture=DECK_3_DEFLECTOR_APERTURE;
  return assembly;
}
