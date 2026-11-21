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

  let moveInput = { x: 0, y: 0 };
  let sprintHeld = false;
  let jumpQueued = false;
  let movePointer = null;
  let aimPointer = null;
  let previousAimX = 0;
  let previousAimY = 0;

  const setMoveInput = (x, y) => {
    moveInput = { x, y };
  };

  const stopSprint = () => {
    sprintHeld = false;
    sprintButton?.classList.remove('is-active');
  };

  const queueJump = () => {
    if (!isOnFoot() || !isGrounded()) return false;
    jumpQueued = true;
    return true;
  };

  const moveStick = event => {
    if (!isOnFoot()) { setMoveInput(0, 0); return; }
    const rect = characterStick.getBoundingClientRect();
    const max = rect.width * 0.31;
    if (!(max > 0)) {
      setMoveInput(0, 0);
      return;
    }
    let x = event.clientX - rect.left - rect.width / 2;
    let y = event.clientY - rect.top - rect.height / 2;
    const length = Math.hypot(x, y);
    if (length > max) {
      x *= max / length;
      y *= max / length;
    }
    setMoveInput(x / max, y / max);
    if (knob) knob.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
  };

  if (characterStick) {
    characterStick.addEventListener('pointerdown', event => {
      if (!isOnFoot()) return;
      event.preventDefault();
      movePointer = event.pointerId;
      characterStick.setPointerCapture(movePointer);
      moveStick(event);
    });
    characterStick.addEventListener('pointermove', event => {
      if (movePointer !== event.pointerId) return;
      event.preventDefault();
      moveStick(event);
    });
    const endMove = event => {
      if (movePointer !== event.pointerId) return;
      movePointer = null;
      setMoveInput(0, 0);
      if (knob) knob.style.transform = 'translate(0,0)';
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
      characterStick.addEventListener(type, endMove);
    });
  }

  jumpButton?.addEventListener('pointerdown', event => {
    event.preventDefault();
    queueJump();
  });

  sprintButton?.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (!isOnFoot()) return;
    sprintHeld = true;
    sprintButton.classList.add('is-active');
    sprintButton.setPointerCapture(event.pointerId);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
    sprintButton?.addEventListener(type, stopSprint);
  });

  window.addEventListener('keydown', event => {
    if (!isOnFoot() || event.repeat) return;
    if (event.code === 'Space') {
      event.preventDefault();
      queueJump();
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') sprintHeld = true;
  });
  window.addEventListener('keyup', event => {
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') stopSprint();
  });
  window.addEventListener('blur', stopSprint);

  const handlePhaserInput = event => {
    if (event.type === 'click' && event.detail !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onFirePhaser();
  };
  phaserButton?.addEventListener('pointerup', handlePhaserInput);
  phaserButton?.addEventListener('click', handlePhaserInput);

  aimButton?.addEventListener('click', onToggleAim);

  const aimArea = get('character-aim-area');
  if (aimArea) {
    aimArea.addEventListener('pointerdown', event => {
      event.preventDefault();
      aimPointer = event.pointerId;
      previousAimX = event.clientX;
      previousAimY = event.clientY;
      aimArea.setPointerCapture(aimPointer);
    });
    aimArea.addEventListener('pointermove', event => {
      if (aimPointer !== event.pointerId) return;
      event.preventDefault();
      const dx = event.clientX - previousAimX;
      const dy = event.clientY - previousAimY;
      previousAimX = event.clientX;
      previousAimY = event.clientY;
      onAimLook(dx, dy);
    });
    const endAim = event => {
      if (aimPointer === event.pointerId) aimPointer = null;
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
      aimArea.addEventListener(type, endAim);
    });
  }

  return {
    getMoveInput: () => ({ ...moveInput }),
    isSprinting: () => sprintHeld,
    consumeJump: () => {
      const queued = jumpQueued;
      jumpQueued = false;
      return queued;
    },
    stopSprint,
    reset: () => {
      movePointer = null;
      aimPointer = null;
      setMoveInput(0, 0);
      jumpQueued = false;
      stopSprint();
      if (knob) knob.style.transform = 'translate(0,0)';
    },
    jumpButton,
    sprintButton
  };
}
