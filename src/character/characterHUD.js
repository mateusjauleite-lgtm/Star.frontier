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
