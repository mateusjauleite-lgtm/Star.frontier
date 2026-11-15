/**
 * Planejamento do núcleo de interação entre itens e objetos do mundo.
 *
 * Este arquivo acompanha as ramificações do fluxo. As primeiras funções
 * independentes já existem; integração com objetos físicos e inventário fica
 * pendente até haver recipientes reais na gameplay.
 *
 * Não substituir nem alterar o inventário, os slots de equipamento ou a
 * persistência existentes. Quando houver recipientes físicos na gameplay,
 * cada etapa poderá ser implementada em módulo próprio.
 */

export const ITEM_WORLD_INTERACTION_PLAN = Object.freeze({
  status: 'in-progress',

  modules: Object.freeze({
    proximity: Object.freeze({
      status: 'foundation',
      path: './worldInteraction/proximityDetection.js',
      responsibility: 'Detectar quando o personagem entra ou sai da área de interação de um objeto.'
    }),

    lootRecognition: Object.freeze({
      status: 'foundation',
      path: './worldInteraction/lootRecognition.js',
      responsibility: 'Reconhecer o objeto próximo e identificar se é item coletável, armário ou baú.'
    }),

    storageInteraction: Object.freeze({
      status: 'planned',
      responsibility: 'Abrir e fechar a área de loot do recipiente e apresentar seu conteúdo.'
    }),

    itemTransfer: Object.freeze({
      status: 'planned',
      responsibility: 'Mover instâncias entre inventário e recipiente, preservando instanceId, quantidade, durabilidade e metadados.'
    }),

    equipmentBridge: Object.freeze({
      status: 'planned',
      responsibility: 'Reutilizar o fluxo existente de seleção dos slots para equipar ou desequipar itens compatíveis.'
    })
  }),

  constraints: Object.freeze([
    'Não duplicar instâncias durante coleta ou transferência.',
    'Respeitar capacidade e regras de empilhamento do inventário e do recipiente.',
    'Não recriar nem substituir o inventário atual.',
    'Não alterar a persistência ou os slots de equipamento já testados.',
    'Implementar e testar cada módulo somente quando houver objetos do mundo disponíveis na gameplay.'
  ])
});
