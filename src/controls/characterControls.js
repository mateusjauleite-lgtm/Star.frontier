export function registerCharacterControls({
  document,
  window,
  isOnFoot,
  isGrounded,
  onFirePhaser,
  onToggleAim,
  onAimLook
}) {
  const get = id => document.getElementById(id);
  const characterStick = get('character-move-stick');
  const knob = characterStick?.querySelector('.character-move-knob');
  const jumpButton = get('character-jump-btn');
  const sprintButton = get('character-sprint-btn');
  const phaserButton = get('character-phaser-btn');
  const aimButton = get('character-aim-btn');
  const aimArea = get('character-aim-area');

  let enabled = true;
  let moveInput = { x: 0, y: 0 };
  let sprintHeld = false;
  let jumpQueued = false;
  let movePointer = null;
  let sprintPointer = null;
  let aimPointer = null;
  let previousAimX = 0;
  let previousAimY = 0;

  const canUseControls = () => enabled && isOnFoot();
  const setMoveInput = (x, y) => { moveInput = { x, y }; };

  const releaseCapture = (element, pointerId) => {
    if (pointerId === null || pointerId === undefined) return;
    try {
      if (element?.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
    } catch {}
  };

  const stopSprint = () => {
    const pointer = sprintPointer;
    sprintPointer = null;
    sprintHeld = false;
    sprintButton?.classList.remove('is-active');
    releaseCapture(sprintButton, pointer);
  };

  const queueJump = () => {
    if (!canUseControls() || !isGrounded()) return false;
    jumpQueued = true;
    return true;
  };

  const moveStick = event => {
    if (!canUseControls()) { setMoveInput(0, 0); return; }
    const rect = characterStick.getBoundingClientRect();
    const max = rect.width * 0.31;
    if (!(max > 0)) { setMoveInput(0, 0); return; }
    let x = event.clientX - rect.left - rect.width / 2;
    let y = event.clientY - rect.top - rect.height / 2;
    const length = Math.hypot(x, y);
    if (length > max) { x *= max / length; y *= max / length; }
    setMoveInput(x / max, y / max);
    if (knob) knob.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
  };

  if (characterStick) {
    characterStick.addEventListener('pointerdown', event => {
      if (!canUseControls() || movePointer !== null) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      movePointer = event.pointerId;
      try { characterStick.setPointerCapture(movePointer); } catch {}
      moveStick(event);
    });
    characterStick.addEventListener('pointermove', event => {
      if (movePointer !== event.pointerId || !canUseControls()) return;
      event.preventDefault();
      moveStick(event);
    });
    const endMove = event => {
      if (movePointer !== event.pointerId) return;
      movePointer = null;
      setMoveInput(0, 0);
      if (knob) knob.style.transform = 'translate(0,0)';
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => characterStick.addEventListener(type, endMove));
  }

  jumpButton?.addEventListener('pointerdown', event => {
    if (!canUseControls()) return;
    event.preventDefault();
    queueJump();
  });

  sprintButton?.addEventListener('pointerdown', event => {
    if (!canUseControls() || sprintPointer !== null) return;
    event.preventDefault();
    sprintHeld = true;
    sprintPointer = event.pointerId;
    sprintButton.classList.add('is-active');
    try { sprintButton.setPointerCapture(event.pointerId); } catch {}
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
    sprintButton?.addEventListener(type, event => {
      if (sprintPointer !== null && event.pointerId !== undefined && event.pointerId !== sprintPointer) return;
      stopSprint();
    });
  });

  window.addEventListener('keydown', event => {
    if (!canUseControls() || event.repeat) return;
    if (event.code === 'Space') { event.preventDefault(); queueJump(); }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') sprintHeld = true;
  });
  window.addEventListener('keyup', event => {
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') stopSprint();
  });
  window.addEventListener('blur', () => stopSprint());

  const handlePhaserInput = event => {
    if (!canUseControls()) return;
    if (event.type === 'click' && event.detail !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onFirePhaser();
  };
  phaserButton?.addEventListener('pointerup', handlePhaserInput);
  phaserButton?.addEventListener('click', handlePhaserInput);
  aimButton?.addEventListener('click', event => {
    if (!canUseControls()) return;
    event.preventDefault();
    onToggleAim();
  });

  if (aimArea) {
    aimArea.addEventListener('pointerdown', event => {
      if (!canUseControls() || aimPointer !== null) return;
      event.preventDefault();
      aimPointer = event.pointerId;
      previousAimX = event.clientX;
      previousAimY = event.clientY;
      try { aimArea.setPointerCapture(aimPointer); } catch {}
    });
    aimArea.addEventListener('pointermove', event => {
      if (aimPointer !== event.pointerId || !canUseControls()) return;
      event.preventDefault();
      const dx = event.clientX - previousAimX;
      const dy = event.clientY - previousAimY;
      previousAimX = event.clientX;
      previousAimY = event.clientY;
      onAimLook(dx, dy);
    });
    const endAim = event => { if (aimPointer === event.pointerId) aimPointer = null; };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => aimArea.addEventListener(type, endAim));
  }

  const reset = () => {
    const move = movePointer;
    const aim = aimPointer;
    movePointer = null;
    aimPointer = null;
    releaseCapture(characterStick, move);
    releaseCapture(aimArea, aim);
    setMoveInput(0, 0);
    jumpQueued = false;
    stopSprint();
    if (knob) knob.style.transform = 'translate(0,0)';
  };

  return Object.freeze({
    getMoveInput: () => ({ ...moveInput }),
    isSprinting: () => sprintHeld,
    isEnabled: () => enabled,
    setEnabled: value => {
      const next = Boolean(value);
      if (enabled === next) return;
      enabled = next;
      if (!enabled) reset();
    },
    consumeJump: () => {
      const queued = jumpQueued;
      jumpQueued = false;
      return queued && canUseControls();
    },
    stopSprint,
    reset,
    jumpButton,
    sprintButton
  });
}
