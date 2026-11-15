/**
 * Detecção lógica de proximidade para objetos interativos.
 * Não depende de HUD, câmera ou renderizador.
 */

function isVector3(value) {
  return value && Number.isFinite(value.x) &&
    Number.isFinite(value.y) && Number.isFinite(value.z);
}

export function isWithinInteractionRange(origin, target, range) {
  if (!isVector3(origin) || !isVector3(target)) return false;
  if (!Number.isFinite(range) || range < 0) return false;

  const dx = origin.x - target.x;
  const dy = origin.y - target.y;
  const dz = origin.z - target.z;
  return dx * dx + dy * dy + dz * dz <= range * range;
}

export function findNearestInteractable(origin, targets, defaultRange = 2) {
  if (!isVector3(origin) || !Array.isArray(targets)) return null;

  let nearest = null;
  let nearestDistanceSq = Infinity;

  for (const target of targets) {
    if (!target || target.enabled === false || !isVector3(target.position)) continue;
    const range = target.interactionRange ?? defaultRange;
    if (!Number.isFinite(range) || range < 0) continue;

    const dx = origin.x - target.position.x;
    const dy = origin.y - target.position.y;
    const dz = origin.z - target.position.z;
    const distanceSq = dx * dx + dy * dy + dz * dz;

    if (distanceSq <= range * range && distanceSq < nearestDistanceSq) {
      nearest = target;
      nearestDistanceSq = distanceSq;
    }
  }

  return nearest;
}
