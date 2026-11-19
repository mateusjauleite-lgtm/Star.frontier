export function registerAimControls({ document, THREE, state, shipComputer }) {
  const aimArea = document.getElementById('aim-touch-area');
  let aimPointer = null;
  let previousTouchX = 0;
  let previousTouchY = 0;

  if (!aimArea) return;
  aimArea.addEventListener('pointerdown', event => {
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
      x: THREE.MathUtils.clamp(state.view.x - dy * 0.004, -1.15, 1.15),
      // A rotação horizontal permanece contínua e permite voltas completas.
      y: THREE.MathUtils.euclideanModulo(state.view.y - dx * 0.004 + Math.PI, Math.PI * 2) - Math.PI
    };
    if (shipComputer.isTerminalConnected('pilot-console')) {
      shipComputer.dispatch('pilot-console', 'flight', 'look', nextView);
    } else {
      state.view.x = nextView.x;
      state.view.y = nextView.y;
    }
  });

  const endAim = event => {
    if (aimPointer === event.pointerId) aimPointer = null;
  };
  aimArea.addEventListener('pointerup', endAim);
  aimArea.addEventListener('pointercancel', endAim);
  aimArea.addEventListener('lostpointercapture', endAim);
}

export function registerHeldFlightControls({ document, window, state }) {
  function holdButton(id, key) {
    const button = document.getElementById(id);
    if (!button) return;
    let activePointer = null;
    const stop = event => {
      if (activePointer !== null && event?.pointerId !== undefined && event.pointerId !== activePointer) return;
      activePointer = null;
      state[key] = false;
      button.classList.remove('active');
    };
    button.addEventListener('pointerdown', event => {
      if (activePointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      activePointer = event.pointerId;
      // Entradas de propulsão são diretas e não dependem do computador auxiliar.
      state[key] = true;
      button.classList.add('active');
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // pointerup/blur continuam responsáveis por liberar a entrada.
      }
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => button.addEventListener(type, stop));
    window.addEventListener('blur', stop);
  }
  holdButton('throttle-btn', 'throttle');
  holdButton('brake-btn', 'braking');
  holdButton('nitro-btn', 'nitroButton');
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
