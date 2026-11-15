export function createToolCore({ registry } = {}) {
  if (!registry) throw new TypeError('Item registry obrigatório.');
  return Object.freeze({
    inspect: instance => {
      const definition = registry.get(instance?.definitionId);
      if (!definition || definition.category !== 'tool') return null;
      return { id: definition.id, name: definition.name, ...definition.attributes };
    },
    getMiningPower: instance => {
      const definition = registry.get(instance?.definitionId);
      return definition?.category === 'tool' ? (definition.attributes?.miningPower ?? 0) : 0;
    },
    isTool: instance => registry.get(instance?.definitionId)?.category === 'tool'
  });
}
