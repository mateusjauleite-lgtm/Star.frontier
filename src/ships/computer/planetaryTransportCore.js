const finite = value => Number.isFinite(Number(value));
const normalizeDestination = input => {
  if (!input || typeof input !== 'object') throw new TypeError('Destino inválido.');
  const id = String(input.id || '').trim();
  const name = String(input.name || id).trim();
  const latitudeDeg = Number(input.latitudeDeg);
  const longitudeDeg = Number(input.longitudeDeg);
  const elevationMeters = Number(input.elevationMeters ?? 0);
  if (!id || !name || !finite(latitudeDeg) || latitudeDeg < -90 || latitudeDeg > 90 ||
      !finite(longitudeDeg) || longitudeDeg < -180 || longitudeDeg > 180 ||
      !finite(elevationMeters)) throw new TypeError('Destino exige ID, latitude, longitude e elevação válidos.');
  return Object.freeze({
    id, name, bodyId: String(input.bodyId || 'earth'),
    latitudeDeg, longitudeDeg, elevationMeters,
    sourceId: input.sourceId ? String(input.sourceId) : null,
    tags: Object.freeze(Array.isArray(input.tags) ? input.tags.map(String) : [])
  });
};

/**
 * Test-only planetary transport service.
 * It resolves named, georeferenced destinations through the world provider;
 * it never invents surface coordinates or changes orbital/flight physics.
 */
export function createPlanetaryTransportCore({
  resolveDestination,
  moveActor,
  getActors = () => ({}),
  enabled = true
} = {}) {
  if (typeof resolveDestination !== 'function' || typeof moveActor !== 'function') {
    throw new TypeError('PlanetaryTransportCore exige resolvedor de destinos e controlador de atores.');
  }
  const destinations = new Map();
  let active = Boolean(enabled);
  let lastTransfer = null;

  function registerDestination(input) {
    const destination = normalizeDestination(input);
    destinations.set(destination.id, destination);
    return destination;
  }
  function unregisterDestination(id) { return destinations.delete(String(id)); }
  function findDestinations(query = '') {
    const term = String(query).trim().toLocaleLowerCase();
    return [...destinations.values()].filter(destination =>
      !term || [destination.id, destination.name, destination.bodyId, ...destination.tags]
        .some(value => value.toLocaleLowerCase().includes(term))
    );
  }
  function getDestination(id) { return destinations.get(String(id)) ?? null; }
  function teleport(id, { actor = 'ship', altitudeOffsetMeters = 100 } = {}) {
    if (!active) return { ok: false, reason: 'transport-disabled' };
    const destination = getDestination(id);
    if (!destination) return { ok: false, reason: 'destination-not-found' };
    if (!finite(altitudeOffsetMeters) || Number(altitudeOffsetMeters) < 0) {
      return { ok: false, reason: 'invalid-altitude' };
    }
    const resolved = resolveDestination(destination, {
      altitudeOffsetMeters: Number(altitudeOffsetMeters)
    });
    if (!resolved?.position || ![resolved.position.x, resolved.position.y, resolved.position.z].every(finite)) {
      return { ok: false, reason: 'destination-unresolved' };
    }
    const actors = getActors() || {};
    const target = actors[actor];
    if (!target) return { ok: false, reason: 'actor-unavailable' };
    const moved = moveActor(target, resolved, { destination, actor });
    if (moved === false) return { ok: false, reason: 'actor-move-rejected' };
    lastTransfer = Object.freeze({
      destinationId: destination.id, actor, timestamp: Date.now(),
      position: { x: resolved.position.x, y: resolved.position.y, z: resolved.position.z }
    });
    return { ok: true, destination, actor, position: lastTransfer.position };
  }
  return Object.freeze({
    registerDestination, unregisterDestination, findDestinations, getDestination,
    teleport,
    setEnabled(value) { active = Boolean(value); return active; },
    getStatus() {
      return {
        state: active ? 'ready' : 'disabled',
        mode: 'developer-test-only',
        destinationCount: destinations.size,
        lastTransfer
      };
    }
  });
}
