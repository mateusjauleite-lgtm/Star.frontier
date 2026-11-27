/**
 * One-way handoff from the destination console to the physical transporter platform.
 * The console records a validated destination; only the platform consumes the pending packet.
 */
export function createTransporterDispatchBuffer() {
  let pending = null;
  let sequence = 0;

  function queue(destination) {
    if (!destination || typeof destination.id !== 'string' || !destination.id.trim()) {
      throw new TypeError('A transporter destination must have a registered ID.');
    }
    sequence += 1;
    pending = Object.freeze({
      sequence,
      destinationId: destination.id,
      destinationName: String(destination.name || destination.id),
      bodyId: String(destination.bodyId || 'earth'),
      latitudeDeg: Number(destination.latitudeDeg),
      longitudeDeg: Number(destination.longitudeDeg),
      elevationMeters: Number(destination.elevationMeters || 0),
      status: 'queued'
    });
    return pending;
  }

  return Object.freeze({
    queue,
    getPending: () => pending,
    clear: () => { const previous = pending; pending = null; return previous; },
    getStatus: () => pending ? 'queued' : 'empty'
  });
}
