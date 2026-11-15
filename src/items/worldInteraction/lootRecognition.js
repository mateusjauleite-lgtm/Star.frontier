/**
 * Reconhece alvos do mundo que podem participar do fluxo de loot.
 * O objeto físico deve declarar interaction.kind e um id estável.
 */

export const LOOT_TARGET_KINDS = Object.freeze({
  WORLD_ITEM: 'world-item',
  STORAGE: 'storage',
  LOCKER: 'locker',
  CHEST: 'chest'
});

const SUPPORTED_KINDS = new Set(Object.values(LOOT_TARGET_KINDS));

export function recognizeLootTarget(target) {
  if (!target || typeof target !== 'object' || target.enabled === false) return null;

  const interaction = target.interaction;
  if (!interaction || typeof interaction !== 'object') return null;
  if (typeof target.id !== 'string' || !target.id.trim()) return null;
  if (!SUPPORTED_KINDS.has(interaction.kind)) return null;

  if (interaction.kind === LOOT_TARGET_KINDS.WORLD_ITEM) {
    if (typeof target.instanceId !== 'string' || !target.instanceId.trim()) return null;
    return Object.freeze({
      targetId: target.id,
      kind: interaction.kind,
      instanceId: target.instanceId
    });
  }

  if (typeof target.containerId !== 'string' || !target.containerId.trim()) return null;
  return Object.freeze({
    targetId: target.id,
    kind: interaction.kind,
    containerId: target.containerId
  });
}
