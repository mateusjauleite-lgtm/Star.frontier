import { assertValidItemDefinition, validateItemInstance } from './itemValidation.js';

function createInstanceId() {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(value => value.toString(16).padStart(2, '0'));
    return [hex.slice(0, 4).join(''), hex.slice(4, 6).join(''), hex.slice(6, 8).join(''), hex.slice(8, 10).join(''), hex.slice(10, 16).join('')].join('-');
  }
  throw new Error('Não há gerador seguro de UUID disponível neste ambiente.');
}

export function createItemInstance(definition, options = {}) {
  assertValidItemDefinition(definition);
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Opções da instância devem ser um objeto.');
  const quantity = options.quantity ?? 1;
  const instanceId = options.instanceId ?? createInstanceId();
  const durability = options.durability ?? definition.attributes?.durability ?? null;
  const metadata = options.metadata ?? {};
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new TypeError('metadata deve ser um objeto.');
  const instance = { instanceId, definitionId: definition.id, quantity, durability, metadata: { ...metadata } };
  const errors = validateItemInstance(instance, definition);
  if (errors.length) throw new TypeError(errors.join(' '));
  return instance;
}

export function cloneItemInstance(instance) {
  if (!instance || typeof instance !== 'object' || Array.isArray(instance)) throw new TypeError('Instância de item inválida.');
  return { ...instance, metadata: { ...(instance.metadata ?? {}) } };
}
