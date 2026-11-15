/**
 * Planejamento do núcleo de interação entre itens e objetos do mundo.
 *
 * Este arquivo documenta as próximas ramificações sem implementar ainda
 * detecção física, interface de loot ou transferência. O jogo ainda não possui
 * armários/baús integrados para validar esses fluxos.
 *
 * Não substituir nem alterar o inventário, os slots de equipamento ou a
 * persistência existentes. Quando houver recipientes físicos na gameplay,
 * cada etapa poderá ser implementada em módulo próprio.
 */

export const ITEM_WORLD_INTERACTION_PLAN = Object.freeze({
  status: 'planned',

  modules: Object.freeze({
    proximity: Object.freeze({
      status: 'planned',
      responsibility: 'Detectar quando o personagem entra ou sai da área de interação de um objeto.'
    }),

    lootRecognition: Object.freeze({
      status: 'planned',
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
