export function createWeaponCore({ registry } = {}) {
  if (!registry) throw new TypeError('Item registry obrigatório.');
  return Object.freeze({
    inspect: instance => {
      const definition = registry.get(instance?.definitionId);
      if (!definition || definition.category !== 'weapon') return null;
      return { id: definition.id, name: definition.name, ...definition.attributes };
    },
    isWeapon: instance => registry.get(instance?.definitionId)?.category === 'weapon'
  });
}
