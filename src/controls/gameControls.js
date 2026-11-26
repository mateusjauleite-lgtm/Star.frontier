export function registerAimControls({ document, THREE, state, getCameraInput = () => null }) {
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
      const sensitivity = THREE.MathUtils.clamp(Number(state.settings?.sensitivity) || 1, 0.5, 2);
      const nextView = {
        x: THREE.MathUtils.clamp(state.view.x - dy * 0.004 * sensitivity, -1.45, 1.45),
        y: THREE.MathUtils.euclideanModulo(state.view.y - dx * 0.004 * sensitivity + Math.PI, Math.PI * 2) - Math.PI
      };
      const cameraInput = getCameraInput?.();
      if (cameraInput) cameraInput.setView(nextView.x, nextView.y);
      else {
        state.view.x = nextView.x;
        state.view.y = nextView.y;
      }
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
    const sensitivity = THREE.MathUtils.clamp(Number(state.settings?.sensitivity) || 1, 0.5, 2);
    const aimX = THREE.MathUtils.clamp(x / max * sensitivity, -1, 1);
    const aimY = THREE.MathUtils.clamp(y / max * sensitivity, -1, 1);
    const cameraInput = getCameraInput?.();
    if (cameraInput) {
      cameraInput.setAim(aimX, aimY);
      cameraInput.setView(
        state.view.x - aimY * 0.035,
        state.view.y + aimX * 0.055
      );
    } else {
      state.aim.x = aimX;
      state.aim.y = aimY;
      state.view.y = THREE.MathUtils.euclideanModulo(state.view.y + state.aim.x * 0.055 + Math.PI, Math.PI * 2) - Math.PI;
      state.view.x = THREE.MathUtils.clamp(state.view.x - state.aim.y * 0.035, -1.45, 1.45);
    }
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
    const cameraInput = getCameraInput?.();
    if (cameraInput) cameraInput.resetAim();
    else { state.aim.x = 0; state.aim.y = 0; }
    if (knob) knob.style.transform = 'translate(-50%,-50%)';
  };
  aimStick.addEventListener('pointerup', endStick);
  aimStick.addEventListener('pointercancel', endStick);
  aimStick.addEventListener('lostpointercapture', endStick);
}

export function registerHeldFlightControls({ document, window, state, dispatchPropulsionCommand = null, onWarpRejected = () => {} }) {
  function holdButton(id, key, control) {
    const button = document.getElementById(id);
    if (!button) return;
    let activePointer = null;
    const apply = active => {
      if (typeof dispatchPropulsionCommand === 'function') {
        return dispatchPropulsionCommand({ control, active })?.accepted === true;
      }
      if (control.startsWith('maneuver')) {
        state.maneuver ||= { left: false, right: false, up: false, down: false };
        state.maneuver[control.slice('maneuver'.length).toLowerCase()] = active;
      } else state[key] = active;
      return true;
    };
    const stop = event => {
      if (activePointer !== null && event?.pointerId !== undefined && event.pointerId !== activePointer) return;
      if (activePointer !== null) apply(false);
      activePointer = null;
      if (control.startsWith('maneuver')) {
        state.maneuver ||= { left: false, right: false, up: false, down: false };
        state.maneuver[control.slice('maneuver'.length).toLowerCase()] = false;
      } else state[key] = false;
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
  // Propulsor principal funciona como a dobra: toque liga, novo toque desliga.
  const throttleButton = document.getElementById('throttle-btn');
  if (throttleButton) {
    throttleButton.setAttribute('aria-pressed', String(Boolean(state.throttle)));
    throttleButton.classList.toggle('active', Boolean(state.throttle));
    throttleButton.addEventListener('click', () => {
      const active = !Boolean(state.throttle);
      let accepted = true;
      if (typeof dispatchPropulsionCommand === 'function') {
        accepted = dispatchPropulsionCommand({ control: 'throttle', active })?.accepted === true;
      } else {
        state.throttle = active;
      }
      if (!accepted) {
        onWarpRejected('throttle-command-rejected');
        return;
      }
      state.throttle = active;
      throttleButton.setAttribute('aria-pressed', String(active));
      throttleButton.classList.toggle('active', active);
    });
  }
  holdButton('brake-btn', 'braking', 'braking');
  holdButton('maneuver-left-btn', 'maneuverLeft', 'maneuverLeft');
  holdButton('maneuver-right-btn', 'maneuverRight', 'maneuverRight');
  holdButton('maneuver-up-btn', 'maneuverUp', 'maneuverUp');
  holdButton('maneuver-down-btn', 'maneuverDown', 'maneuverDown');

  // Dobra é um comando de alternância: não depende de manter o toque pressionado.
  const warpButton = document.getElementById('warp-drive-btn');
  if (warpButton) {
    warpButton.setAttribute('aria-pressed', String(Boolean(state.warpDriveButton)));
    warpButton.addEventListener('click', () => {
      const active = !Boolean(state.warpDriveButton);
      if (typeof dispatchPropulsionCommand === 'function') {
        const result = dispatchPropulsionCommand({ control: 'warpDriveButton', active });
        if (result?.accepted !== true) { onWarpRejected(result?.reason || 'warp-command-rejected'); return; }
      } else {
        state.warpDriveButton = active;
        if (active) state.warpStage = 5;
      }
      warpButton.setAttribute('aria-pressed', String(active));
      warpButton.classList.toggle('active', active);
    });
  }
}

export function registerFlightSelectionGuards({ document }) {
  document.addEventListener('contextmenu', event => {
    if (event.target.closest('#flight-controls')) event.preventDefault();
  });
  document.addEventListener('selectstart', event => {
    if (event.target.closest('#flight-controls')) event.preventDefault();
  });
}

export function registerCameraCycleControl({ document, state, cameraNames, getCameraInput = () => null }) {
  document.getElementById('camera-btn')?.addEventListener('click', () => {
    const nextMode = (state.camera + 1) % 3;
    const cameraInput = getCameraInput?.();
    if (cameraInput) cameraInput.setShipMode(nextMode);
    else state.camera = nextMode;
    document.getElementById('camera-btn').textContent = cameraNames[state.camera];
  });
}
