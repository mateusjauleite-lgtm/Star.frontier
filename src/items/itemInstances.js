let fallbackSequence = 0;
function createInstanceId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  fallbackSequence += 1;
  return `item-instance-${Date.now().toString(36)}-${fallbackSequence.toString(36)}`;
}

export function createItemInstance(definition, options = {}) {
  if (!definition?.id) throw new TypeError('Definição de item necessária.');
  const quantity = options.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1) throw new RangeError('Quantidade deve ser um inteiro positivo.');
  if (!definition.stackable && quantity !== 1) throw new RangeError('Este item não pode formar pilha.');
  if (quantity > definition.maxStack) throw new RangeError('Quantidade excede o limite da pilha.');
  return {
    instanceId: options.instanceId ?? createInstanceId(),
    definitionId: definition.id,
    quantity,
    durability: options.durability ?? definition.attributes?.durability ?? null,
    metadata: { ...(options.metadata ?? {}) }
  };
}

export function cloneItemInstance(instance) {
  return { ...instance, metadata: { ...(instance.metadata ?? {}) } };
}
