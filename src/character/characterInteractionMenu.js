/**
 * Contextual circular action menu for nearby crew members.
 * The menu is anchored to the crew member's projected screen position.
 */
export function createCharacterInteractionMenu({ root, camera, actor, onConfirm }) {
  if (!root || !camera || !actor) throw new TypeError('Menu de tripulante sem dependências.');
  const menu = document.createElement('section');
  menu.className = 'crew-wheel hidden';
  menu.setAttribute('aria-label', 'Interação com Alexia');
  menu.innerHTML = `
    <div class="crew-wheel-title">ALEXIA <small>INTERAÇÃO</small></div>
    <button class="crew-wheel-option crew-follow" type="button" data-action="follow">↗<span>FOLLOW</span></button>
    <button class="crew-wheel-option crew-console" type="button" disabled aria-label="Ocupar console e trabalhar">⌘<span>OCUPAR CONSOLE</span><small>EM BREVE</small></button>
    <button class="crew-wheel-close" type="button" aria-label="Fechar menu">×</button>
    <div class="crew-confirm hidden" role="dialog" aria-label="Confirmar ação">
      <b>CONFIRMAR AÇÃO?</b>
      <span class="crew-confirm-description">Alexia seguirá você.</span>
      <div><button type="button" data-confirm="yes">CONFIRMAR</button><button type="button" data-confirm="back">VOLTAR</button></div>
    </div>`;
  root.appendChild(menu);

  const confirmPanel = menu.querySelector('.crew-confirm');
  const followButton = menu.querySelector('.crew-follow');
  let selectedAction = null;

  function close() {
    menu.classList.add('hidden');
    confirmPanel.classList.add('hidden');
    menu.classList.remove('is-confirming');
    selectedAction = null;
  }

  function open() {
    menu.classList.remove('hidden');
    confirmPanel.classList.add('hidden');
    menu.classList.remove('is-confirming');
    selectedAction = null;
    updatePosition();
  }

  function updatePosition() {
    if (menu.classList.contains('hidden')) return;
    actor.updateWorldMatrix(true, false);
    const point = actor.getWorldPosition(actor.position.clone());
    point.y += 1.05;
    point.project(camera);
    const rect = root.getBoundingClientRect();
    const x = (point.x * 0.5 + 0.5) * rect.width;
    const y = (-point.y * 0.5 + 0.5) * rect.height;
    menu.style.left = Math.max(92, Math.min(rect.width - 92, x)) + 'px';
    menu.style.top = Math.max(110, Math.min(rect.height - 100, y)) + 'px';
  }

  followButton.addEventListener('click', () => {
    selectedAction = 'follow';
    confirmPanel.classList.remove('hidden');
    menu.classList.add('is-confirming');
  });
  menu.querySelector('[data-confirm="back"]').addEventListener('click', () => {
    selectedAction = null;
    confirmPanel.classList.add('hidden');
    menu.classList.remove('is-confirming');
  });
  menu.querySelector('[data-confirm="yes"]').addEventListener('click', () => {
    if (selectedAction) onConfirm?.(selectedAction);
    close();
  });
  menu.querySelector('.crew-wheel-close').addEventListener('click', close);

  return Object.freeze({ open, close, updatePosition, dispose: () => menu.remove(), isOpen: () => !menu.classList.contains('hidden') });
}
