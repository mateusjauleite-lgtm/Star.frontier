export function validateItemDefinition(item) {
  const errors = [];
  if (!item || typeof item !== 'object') return ['A definição deve ser um objeto.'];
  if (typeof item.id !== 'string' || !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(item.id)) errors.push('ID inválido: use um identificador estável em minúsculas.');
  if (typeof item.name !== 'string' || !item.name.trim()) errors.push('Nome do item obrigatório.');
  if (!['weapon', 'tool', 'equipment', 'resource', 'consumable'].includes(item.category)) errors.push('Categoria de item inválida.');
  if (typeof item.stackable !== 'boolean') errors.push('stackable deve ser booleano.');
  if (!Number.isFinite(item.maxStack) || item.maxStack < 1 || (!item.stackable && item.maxStack !== 1)) errors.push('maxStack inválido.');
  if (!Number.isFinite(item.weight) || item.weight < 0) errors.push('weight deve ser um número não negativo.');
  return errors;
}

export function assertValidItemDefinition(item) {
  const errors = validateItemDefinition(item);
  if (errors.length) throw new TypeError(`Item "${item?.id ?? 'unknown'}": ${errors.join(' ')}`);
  return item;
}
