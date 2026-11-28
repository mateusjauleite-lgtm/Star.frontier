import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterInteractionManager } from './characterInteractionManager.js';

function createButton() {
  const classes = new Set();
  return {
    disabled: true,
    textContent: 'AÇÃO',
    dataset: {},
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); }
    }
  };
}

test('seleciona uma única interação pela maior prioridade', () => {
  const button = createButton();
  const activated = [];
  const manager = createCharacterInteractionManager({ button });
  const selected = manager.render([
    { id: 'engineering', priority: 40, available: true, label: 'ENGENHARIA', activate: () => activated.push('engineering') },
    { id: 'alexia', priority: 90, available: true, label: 'ALEXIA', activate: () => activated.push('alexia') }
  ]);

  assert.equal(selected.id, 'alexia');
  assert.equal(button.textContent, 'ALEXIA');
  assert.equal(button.dataset.interaction, 'alexia');
  assert.equal(button.disabled, false);
  assert.equal(button.classList.contains('available'), true);
  assert.equal(manager.activate(), true);
  assert.deepEqual(activated, ['alexia']);
});

test('mantém a ordem de registro quando as prioridades empatam', () => {
  const manager = createCharacterInteractionManager();
  const selected = manager.render([
    { id: 'first', priority: 10, available: true },
    { id: 'second', priority: 10, available: true }
  ]);
  assert.equal(selected.id, 'first');
});

test('permite publicar um estado visível, mas desabilitado, como elevador em movimento', () => {
  const button = createButton();
  const manager = createCharacterInteractionManager({ button });
  const selected = manager.render([
    { id: 'elevator-moving', priority: 80, available: false, disabled: true, label: 'ELEVADOR...' },
    { id: 'pilot', priority: 10, available: true, label: 'PILOTAR' }
  ]);

  assert.equal(selected.id, 'elevator-moving');
  assert.equal(button.textContent, 'ELEVADOR...');
  assert.equal(button.disabled, true);
  assert.equal(button.classList.contains('available'), false);
  assert.equal(manager.activate(), false);
});

test('limpa a seleção e aplica o estado de fallback quando não há candidatos', () => {
  const button = createButton();
  const targets = [];
  const manager = createCharacterInteractionManager({
    button,
    onTargetChange: target => targets.push(target)
  });
  manager.render([{ id: 'alexia', available: true, label: 'ALEXIA', target: 'TRIPULANTE ALEXIA' }]);
  manager.render([], { hidden: true, label: 'AÇÃO', target: 'ELEVADOR INTERNO' });

  assert.equal(manager.getActiveInteraction(), null);
  assert.equal(button.classList.contains('hidden'), true);
  assert.equal(button.dataset.interaction, '');
  assert.equal(button.disabled, true);
  assert.equal(targets.at(-1), 'ELEVADOR INTERNO');
});

test('não publica novamente o alvo quando a interação permanece estável', () => {
  let changes = 0;
  const manager = createCharacterInteractionManager({ onTargetChange: () => { changes += 1; } });
  const candidate = { id: 'matrix', available: true, target: 'MATRIZ' };
  manager.render([candidate]);
  manager.render([candidate]);
  assert.equal(changes, 1);
});
