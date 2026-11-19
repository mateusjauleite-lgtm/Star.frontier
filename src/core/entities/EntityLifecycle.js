const TRANSITIONS = {
  created: new Set(['active', 'inactive', 'destroyed']),
  active: new Set(['inactive', 'destroyed']),
  inactive: new Set(['active', 'destroyed']),
  destroyed: new Set()
};

export class EntityLifecycle {
  transition(entity, nextStatus) {
    if (!entity || !TRANSITIONS[entity.status]) throw new TypeError('Entidade ou status atual inválido.');
    if (!TRANSITIONS[entity.status].has(nextStatus)) {
      throw new Error(`Transição de ${entity.status} para ${nextStatus} não permitida.`);
    }
    const previousStatus = entity.status;
    entity.update({ status: nextStatus });
    return { entity, previousStatus, status: nextStatus };
  }

  activate(entity) { return this.transition(entity, 'active'); }
  deactivate(entity) { return this.transition(entity, 'inactive'); }
  destroy(entity) { return this.transition(entity, 'destroyed'); }
}
