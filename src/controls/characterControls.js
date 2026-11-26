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
  const aimStick = get('character-aim-stick');
  const aimKnob = aimStick?.querySelector('.character-aim-knob');

  let moveInput = { x: 0, y: 0 };
  let aimInput = { x: 0, y: 0 };
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
      event.stopPropagation?.();
      movePointer = event.pointerId;
      characterStick.setPointerCapture(movePointer);
      moveStick(event);
    });
    characterStick.addEventListener('pointermove', event => {
      if (movePointer !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation?.();
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

  if (aimStick) {
    const updateAimStick = event => {
      if (!isOnFoot()) { aimInput = { x: 0, y: 0 }; return; }
      const rect = aimStick.getBoundingClientRect();
      const max = Math.max(1, rect.width * 0.34);
      let x = event.clientX - rect.left - rect.width / 2;
      let y = event.clientY - rect.top - rect.height / 2;
      const length = Math.hypot(x, y);
      if (length > max) { x *= max / length; y *= max / length; }
      aimInput = { x: x / max, y: y / max };
      if (aimKnob) aimKnob.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
    };
    aimStick.addEventListener('pointerdown', event => {
      if (!isOnFoot() || aimPointer !== null) return;
      event.preventDefault();
      event.stopPropagation?.();
      aimPointer = event.pointerId;
      aimStick.classList.add('is-active');
      aimStick.setPointerCapture(aimPointer);
      updateAimStick(event);
    });
    aimStick.addEventListener('pointermove', event => {
      if (aimPointer !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation?.();
      updateAimStick(event);
    });
    const endAim = event => {
      if (aimPointer !== event.pointerId) return;
      aimPointer = null;
      aimInput = { x: 0, y: 0 };
      aimStick.classList.remove('is-active');
      if (aimKnob) aimKnob.style.transform = 'translate(-50%,-50%)';
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => aimStick.addEventListener(type, endAim));
  }

  return {
    getMoveInput: () => ({ ...moveInput }),
    getAimInput: () => ({ ...aimInput }),
    updateAim: dt => {
      if (!isOnFoot()) { aimInput = { x: 0, y: 0 }; return; }
      const delta = Math.min(Math.max(Number(dt) || 0, 0), 0.05) * 240;
      if (delta > 0 && (Math.abs(aimInput.x) + Math.abs(aimInput.y)) > 0.04) onAimLook(aimInput.x * delta, aimInput.y * delta);
    },
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
      aimInput = { x: 0, y: 0 };
      aimStick?.classList.remove('is-active');
      if (aimKnob) aimKnob.style.transform = 'translate(-50%,-50%)';
      setMoveInput(0, 0);
      jumpQueued = false;
      stopSprint();
      if (knob) knob.style.transform = 'translate(0,0)';
    },
    jumpButton,
    sprintButton
  };
}
