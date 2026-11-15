const ITEM_CATEGORIES = new Set(['weapon', 'tool', 'equipment', 'resource', 'consumable']);
const ITEM_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export function validateItemDefinition(item) {
  const errors = [];
  if (!item || typeof item !== 'object' || Array.isArray(item)) return ['A definição deve ser um objeto.'];
  if (typeof item.id !== 'string' || !ITEM_ID_PATTERN.test(item.id)) errors.push('ID inválido: use um identificador estável em minúsculas.');
  if (typeof item.name !== 'string' || !item.name.trim()) errors.push('Nome do item obrigatório.');
  if (!ITEM_CATEGORIES.has(item.category)) errors.push('Categoria de item inválida.');
  if (typeof item.stackable !== 'boolean') errors.push('stackable deve ser booleano.');
  if (!Number.isSafeInteger(item.maxStack) || item.maxStack < 1 || (!item.stackable && item.maxStack !== 1)) errors.push('maxStack deve ser um inteiro positivo e itens únicos devem usar 1.');
  if (typeof item.weight !== 'number' || !Number.isFinite(item.weight) || item.weight < 0) errors.push('weight deve ser um número finito não negativo.');
  if (item.attributes !== undefined && (!item.attributes || typeof item.attributes !== 'object' || Array.isArray(item.attributes))) errors.push('attributes deve ser um objeto.');
  if (item.tags !== undefined && (!Array.isArray(item.tags) || item.tags.some(tag => typeof tag !== 'string'))) errors.push('tags deve ser uma lista de textos.');
  return errors;
}

export function assertValidItemDefinition(item) {
  const errors = validateItemDefinition(item);
  if (errors.length) throw new TypeError(`Item "${item?.id ?? 'unknown'}": ${errors.join(' ')}`);
  return item;
}

export function validateItemInstance(instance, definition) {
  const errors = [];
  if (!instance || typeof instance !== 'object' || Array.isArray(instance)) return ['A instância deve ser um objeto.'];
  if (typeof instance.instanceId !== 'string' || !instance.instanceId.trim()) errors.push('instanceId obrigatório.');
  if (!definition || instance.definitionId !== definition.id) errors.push('definitionId não corresponde à definição registrada.');
  if (!Number.isSafeInteger(instance.quantity) || instance.quantity < 1 || instance.quantity > (definition?.maxStack ?? 0)) errors.push('Quantidade da instância inválida.');
  if (definition && !definition.stackable && instance.quantity !== 1) errors.push('Item não empilhável deve ter quantidade 1.');
  if (instance.durability !== null && instance.durability !== undefined && (typeof instance.durability !== 'number' || !Number.isFinite(instance.durability) || instance.durability < 0)) errors.push('Durabilidade deve ser um número finito não negativo.');
  if (instance.metadata !== undefined && (!instance.metadata || typeof instance.metadata !== 'object' || Array.isArray(instance.metadata))) errors.push('metadata deve ser um objeto.');
  return errors;
}
