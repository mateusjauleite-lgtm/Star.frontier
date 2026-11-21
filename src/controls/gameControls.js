export function registerAimControls({ document, THREE, state }) {
  // Arrasto livre de câmera em 360°: não altera a orientação física da nave.
  const aimArea = document.getElementById('aim-touch-area');
  let aimPointer = null;
  let previousTouchX = 0;
  let previousTouchY = 0;

  if (aimArea) {
    aimArea.addEventListener('pointerdown', event => {
      if (event.target.closest('#aim-stick')) return;
      event.preventDefault();
      aimPointer = event.pointerId;
      previousTouchX = event.clientX;
      previousTouchY = event.clientY;
      aimArea.setPointerCapture(aimPointer);
    });
    aimArea.addEventListener('pointermove', event => {
      if (aimPointer !== event.pointerId) return;
      event.preventDefault();
      const dx = event.clientX - previousTouchX;
      const dy = event.clientY - previousTouchY;
      previousTouchX = event.clientX;
      previousTouchY = event.clientY;
      const nextView = {
        x: THREE.MathUtils.clamp(state.view.x - dy * 0.004, -1.45, 1.45),
        y: THREE.MathUtils.euclideanModulo(state.view.y - dx * 0.004 + Math.PI, Math.PI * 2) - Math.PI
      };
      state.view.x = nextView.x;
      state.view.y = nextView.y;
    });
    const endAim = event => { if (aimPointer === event.pointerId) aimPointer = null; };
    aimArea.addEventListener('pointerup', endAim);
    aimArea.addEventListener('pointercancel', endAim);
    aimArea.addEventListener('lostpointercapture', endAim);
  }

  // Joystick de mira separado: desloca o ponto de visão relativo ao casco.
  const aimStick = document.getElementById('aim-stick');
  if (!aimStick) return;
  const knob = aimStick.querySelector('.knob');
  let stickPointer = null;
  const updateAim = event => {
    const rect = aimStick.getBoundingClientRect();
    const max = Math.max(1, rect.width * 0.31);
    let x = event.clientX - rect.left - rect.width / 2;
    let y = event.clientY - rect.top - rect.height / 2;
    const length = Math.hypot(x, y);
    if (length > max) { x *= max / length; y *= max / length; }
    state.aim.x = THREE.MathUtils.clamp(x / max, -1, 1);
    state.aim.y = THREE.MathUtils.clamp(y / max, -1, 1);
    state.view.y = THREE.MathUtils.euclideanModulo(state.view.y + state.aim.x * 0.055 + Math.PI, Math.PI * 2) - Math.PI;
    state.view.x = THREE.MathUtils.clamp(state.view.x - state.aim.y * 0.035, -1.45, 1.45);
    if (knob) knob.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
  };
  aimStick.addEventListener('pointerdown', event => {
    if (stickPointer !== null) return;
    event.preventDefault();
    stickPointer = event.pointerId;
    aimStick.setPointerCapture(stickPointer);
    updateAim(event);
  });
  aimStick.addEventListener('pointermove', event => {
    if (stickPointer !== event.pointerId) return;
    event.preventDefault();
    updateAim(event);
  });
  const endStick = event => {
    if (stickPointer !== event.pointerId) return;
    stickPointer = null;
    state.aim.x = 0;
    state.aim.y = 0;
    if (knob) knob.style.transform = 'translate(-50%,-50%)';
  };
  aimStick.addEventListener('pointerup', endStick);
  aimStick.addEventListener('pointercancel', endStick);
  aimStick.addEventListener('lostpointercapture', endStick);
}

export function registerHeldFlightControls({ document, window, state, dispatchPropulsionCommand = null }) {
  function holdButton(id, key, control) {
    const button = document.getElementById(id);
    if (!button) return;
    let activePointer = null;
    const apply = active => {
      if (typeof dispatchPropulsionCommand === 'function') {
        return dispatchPropulsionCommand({ control, active })?.accepted === true;
      }
      state[key] = active;
      return true;
    };
    const stop = event => {
      if (activePointer !== null && event?.pointerId !== undefined && event.pointerId !== activePointer) return;
      if (activePointer !== null) apply(false);
      activePointer = null;
      state[key] = false;
      button.classList.remove('active');
    };
    button.addEventListener('pointerdown', event => {
      if (activePointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      if (!apply(true)) return;
      activePointer = event.pointerId;
      button.classList.add('active');
      try { button.setPointerCapture(event.pointerId); } catch {
        // pointerup/blur continuam responsáveis por liberar a entrada.
      }
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => button.addEventListener(type, stop));
    window.addEventListener('blur', stop);
  }
  holdButton('throttle-btn', 'throttle', 'throttle');
  holdButton('brake-btn', 'braking', 'braking');
  holdButton('warp-drive-btn', 'warpDriveButton', 'warpDriveButton');
}

export function registerFlightSelectionGuards({ document }) {
  document.addEventListener('contextmenu', event => {
    if (event.target.closest('#flight-controls')) event.preventDefault();
  });
  document.addEventListener('selectstart', event => {
    if (event.target.closest('#flight-controls')) event.preventDefault();
  });
}

export function registerCameraCycleControl({ document, state, cameraNames }) {
  document.getElementById('camera-btn')?.addEventListener('click', () => {
    state.camera = (state.camera + 1) % 3;
    document.getElementById('camera-btn').textContent = cameraNames[state.camera];
  });
}
