// HUD do personagem — separado da interface de pilotagem.
const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));

export function createCharacterHUD(root = document) {
  const $ = id => root.getElementById(id);

  function setBar(id, value) {
    const amount = clamp(value);
    const fill = $(id);
    const label = $(id + '-value');
    if (fill) fill.style.width = amount + '%';
    if (label) label.textContent = Math.round(amount) + '%';
  }

  function update(snapshot = {}) {
    if ($('character-name')) {
      $('character-name').textContent = snapshot.name || 'EXPLORADOR';
    }
    if ($('character-mode')) {
      $('character-mode').textContent =
        snapshot.mode === 'ship-control' ? 'NO COMANDO' : 'A PÉ';
    }
    setBar('character-health', snapshot.health ?? 100);
    setBar('character-stamina', snapshot.stamina ?? 100);

    const suit = snapshot.equipment?.suit || 'Traje de exploração básico';
    const tool = snapshot.equipment?.tool || 'Nenhuma ferramenta equipada';
    if ($('character-suit')) $('character-suit').textContent = suit;
    if ($('character-tool')) $('character-tool').textContent = tool;
    if ($('character-posture')) {
      $('character-posture').textContent = snapshot.posture === 'seated' ? 'SENTADO' : 'EM PÉ';
    }
    if ($('character-grounded')) {
      $('character-grounded').textContent = snapshot.grounded === false ? 'NO AR' : 'NO CHÃO';
    }
    if ($('character-movement')) {
      const movement = snapshot.movement || { x: 0, y: 0 };
      const moving = Math.hypot(Number(movement.x) || 0, Number(movement.y) || 0) > 0.08;
      $('character-movement').textContent = moving ? 'EM MOVIMENTO' : 'PARADO';
    }

    const target = snapshot.interactionTarget;
    if ($('character-interaction')) {
      $('character-interaction').textContent = target
        ? (typeof target === 'string' ? target : target.label || 'ALVO DISPONÍVEL')
        : 'SEM ALVO PRÓXIMO';
    }
  }

  function show(visible = true) {
    $('character-hud')?.classList.toggle('hidden', !visible);
  }

  return Object.freeze({ update, show });
}
