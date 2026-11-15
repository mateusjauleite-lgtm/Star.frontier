export function transferInventoryInstance(source, destination, instanceId) {
  if (!source || typeof source.removeInstance !== 'function' ||
      typeof source.items === 'undefined' ||
      !destination || typeof destination.addInstance !== 'function' ||
      typeof destination.removeInstance !== 'function') {
    return { ok: false, reason: 'invalid-inventory' };
  }
  if (source === destination) return { ok: false, reason: 'same-inventory' };
  if (typeof instanceId !== 'string' || !instanceId.trim()) {
    return { ok: false, reason: 'invalid-instance-id' };
  }

  const instance = source.items.find(item => item.instanceId === instanceId);
  if (!instance) return { ok: false, reason: 'instance-not-found' };

  const inserted = destination.addInstance(instance);
  if (!inserted.ok) return inserted;

  const removed = source.removeInstance(instanceId);
  if (!removed) {
    destination.removeInstance(instanceId);
    return { ok: false, reason: 'source-changed' };
  }

  return { ok: true, reason: null, instance: removed };
}
