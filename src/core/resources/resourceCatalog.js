// Identidade canônica dos recursos reconhecidos pelo universo e pelos sistemas da nave.
// IDs são estáveis: inventário, mineração, refinaria e Ship Computer usam os mesmos identificadores.
export const RESOURCE_IDS = Object.freeze({
  DILITHIUM_ORE: 'resource:ore-dilithium',
  REFINED_DILITHIUM: 'resource:dilithium-refined'
});

export const RESOURCE_CATALOG = Object.freeze({
  [RESOURCE_IDS.DILITHIUM_ORE]: Object.freeze({
    id: RESOURCE_IDS.DILITHIUM_ORE,
    itemId: 'ore.dilithium.raw',
    name: 'Minério bruto de dilítio',
    category: 'mineral',
    materialType: 'fictional-mineral',
    fictional: true,
    periodicTableElement: false,
    refinedProductId: RESOURCE_IDS.REFINED_DILITHIUM,
    visual: Object.freeze({ color: 0x38d8ff, emissive: 0x087fa8 })
  }),
  [RESOURCE_IDS.REFINED_DILITHIUM]: Object.freeze({
    id: RESOURCE_IDS.REFINED_DILITHIUM,
    itemId: 'material.dilithium.refined',
    name: 'Dilítio refinado',
    category: 'refined-material',
    materialType: 'fictional-crystalline-material',
    fictional: true,
    periodicTableElement: false,
    rawResourceId: RESOURCE_IDS.DILITHIUM_ORE,
    visual: Object.freeze({ color: 0x64e8ff, emissive: 0x16a8d0 })
  })
});

export function getResourceDefinition(resourceId) {
  return RESOURCE_CATALOG[resourceId] ?? null;
}

export function createResourceEntityData(resourceId) {
  const resource = getResourceDefinition(resourceId);
  if (!resource) throw new Error(`Recurso desconhecido: ${resourceId}`);
  return {
    id: resource.id,
    type: 'resource',
    name: resource.name,
    tags: ['resource', resource.category, resource.materialType],
    metadata: { ...resource, visual: { ...resource.visual } }
  };
}
