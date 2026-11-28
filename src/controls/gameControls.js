export function registerAimControls({ document, THREE, state, getCameraInput = () => null }) {
  const aimArea = document.getElementById('aim-touch-area');
  const aimStick = document.getElementById('aim-stick');
  const knob = aimStick?.querySelector('.knob');
  let enabled = false;
  let aimPointer = null;
  let stickPointer = null;
  let previousTouchX = 0;
  let previousTouchY = 0;

  const releaseCapture = (element, pointerId) => {
    if (pointerId === null || pointerId === undefined) return;
    try {
      if (element?.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
    } catch {}
  };

  if (aimArea) {
    aimArea.addEventListener('pointerdown', event => {
      if (!enabled || event.target.closest('#aim-stick') || aimPointer !== null) return;
      event.preventDefault();
      aimPointer = event.pointerId;
      previousTouchX = event.clientX;
      previousTouchY = event.clientY;
      try { aimArea.setPointerCapture(aimPointer); } catch {}
    });
    aimArea.addEventListener('pointermove', event => {
      if (!enabled || aimPointer !== event.pointerId) return;
      event.preventDefault();
      const dx = event.clientX - previousTouchX;
      const dy = event.clientY - previousTouchY;
      previousTouchX = event.clientX;
      previousTouchY = event.clientY;
      const nextView = {
        x: THREE.MathUtils.clamp(state.view.x - dy * 0.004, -1.45, 1.45),
        y: THREE.MathUtils.euclideanModulo(state.view.y - dx * 0.004 + Math.PI, Math.PI * 2) - Math.PI
      };
      const cameraInput = getCameraInput?.();
      if (cameraInput) cameraInput.setView(nextView.x, nextView.y);
      else { state.view.x = nextView.x; state.view.y = nextView.y; }
    });
    const endAim = event => { if (aimPointer === event.pointerId) aimPointer = null; };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => aimArea.addEventListener(type, endAim));
  }

  const updateAim = event => {
    if (!enabled || !aimStick) return;
    const rect = aimStick.getBoundingClientRect();
    const max = Math.max(1, rect.width * 0.31);
    let x = event.clientX - rect.left - rect.width / 2;
    let y = event.clientY - rect.top - rect.height / 2;
    const length = Math.hypot(x, y);
    if (length > max) { x *= max / length; y *= max / length; }
    const aimX = THREE.MathUtils.clamp(x / max, -1, 1);
    const aimY = THREE.MathUtils.clamp(y / max, -1, 1);
    const cameraInput = getCameraInput?.();
    if (cameraInput) {
      cameraInput.setAim(aimX, aimY);
      cameraInput.setView(state.view.x - aimY * 0.035, state.view.y + aimX * 0.055);
    } else {
      state.aim.x = aimX;
      state.aim.y = aimY;
      state.view.y = THREE.MathUtils.euclideanModulo(state.view.y + state.aim.x * 0.055 + Math.PI, Math.PI * 2) - Math.PI;
      state.view.x = THREE.MathUtils.clamp(state.view.x - state.aim.y * 0.035, -1.45, 1.45);
    }
    if (knob) knob.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
  };

  aimStick?.addEventListener('pointerdown', event => {
    if (!enabled || stickPointer !== null) return;
    event.preventDefault();
    stickPointer = event.pointerId;
    try { aimStick.setPointerCapture(stickPointer); } catch {}
    updateAim(event);
  });
  aimStick?.addEventListener('pointermove', event => {
    if (!enabled || stickPointer !== event.pointerId) return;
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
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => aimStick?.addEventListener(type, endStick));

  const reset = () => {
    const areaPointer = aimPointer;
    const activeStickPointer = stickPointer;
    aimPointer = null;
    stickPointer = null;
    releaseCapture(aimArea, areaPointer);
    releaseCapture(aimStick, activeStickPointer);
    const cameraInput = getCameraInput?.();
    if (cameraInput) cameraInput.resetAim();
    else { state.aim.x = 0; state.aim.y = 0; }
    if (knob) knob.style.transform = 'translate(-50%,-50%)';
  };

  return Object.freeze({
    isEnabled: () => enabled,
    setEnabled: value => {
      const next = Boolean(value);
      if (enabled === next) return;
      enabled = next;
      if (!enabled) reset();
    },
    reset
  });
}

export function registerHeldFlightControls({ document, window, state, dispatchPropulsionCommand = null, onWarpRejected = () => {} }) {
  let enabled = false;
  const resetters = [];

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
      const pointer = activePointer;
      if (pointer !== null) apply(false);
      activePointer = null;
      try {
        if (pointer !== null && button.hasPointerCapture?.(pointer)) button.releasePointerCapture(pointer);
      } catch {}
      if (control.startsWith('maneuver')) {
        state.maneuver ||= { left: false, right: false, up: false, down: false };
        state.maneuver[control.slice('maneuver'.length).toLowerCase()] = false;
      } else state[key] = false;
      button.classList.remove('active');
    };
    resetters.push(stop);
    button.addEventListener('pointerdown', event => {
      if (!enabled || activePointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      if (!apply(true)) return;
      activePointer = event.pointerId;
      button.classList.add('active');
      try { button.setPointerCapture(event.pointerId); } catch {}
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => button.addEventListener(type, stop));
    window.addEventListener('blur', stop);
  }

  const throttleButton = document.getElementById('throttle-btn');
  if (throttleButton) {
    throttleButton.setAttribute('aria-pressed', String(Boolean(state.throttle)));
    throttleButton.classList.toggle('active', Boolean(state.throttle));
    throttleButton.addEventListener('click', () => {
      if (!enabled) return;
      const active = !Boolean(state.throttle);
      let accepted = true;
      if (typeof dispatchPropulsionCommand === 'function') {
        accepted = dispatchPropulsionCommand({ control: 'throttle', active })?.accepted === true;
      } else state.throttle = active;
      if (!accepted) { onWarpRejected('throttle-command-rejected'); return; }
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

  const warpButton = document.getElementById('warp-drive-btn');
  if (warpButton) {
    warpButton.setAttribute('aria-pressed', String(Boolean(state.warpDriveButton)));
    warpButton.addEventListener('click', () => {
      if (!enabled) return;
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

  const reset = () => resetters.forEach(stop => stop());
  return Object.freeze({
    isEnabled: () => enabled,
    setEnabled: value => {
      const next = Boolean(value);
      if (enabled === next) return;
      enabled = next;
      if (!enabled) reset();
    },
    reset
  });
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
