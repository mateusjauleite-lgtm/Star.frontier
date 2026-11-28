export function registerShipMovementControls({
  document,
  window,
  state,
  THREE,
  hasPropulsion = () => true
}) {
  const element = document.getElementById('move-stick');
  const knob = element?.querySelector('.knob');
  let enabled = false;
  let pointer = null;

  const releaseCapture = pointerId => {
    if (pointerId === null || pointerId === undefined) return;
    try {
      if (element?.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
    } catch {}
  };

  const reset = () => {
    const activePointer = pointer;
    pointer = null;
    state.move.x = 0;
    state.move.y = 0;
    releaseCapture(activePointer);
    if (knob) knob.style.transform = 'translate(-50%,-50%)';
    element?.classList.remove('is-active', 'no-propulsion');
  };

  const moveStick = event => {
    if (!enabled || !hasPropulsion()) { reset(); return; }
    const rect = element.getBoundingClientRect();
    const max = Math.max(1, rect.width * 0.34);
    let x = event.clientX - rect.left - rect.width / 2;
    let y = event.clientY - rect.top - rect.height / 2;
    const length = Math.hypot(x, y);
    if (length > max) { x *= max / length; y *= max / length; }
    state.move.x = THREE.MathUtils.clamp(x / max, -1, 1);
    state.move.y = THREE.MathUtils.clamp(y / max, -1, 1);
    element.classList.remove('no-propulsion');
    if (knob) knob.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
  };

  element?.addEventListener('pointerdown', event => {
    if (!enabled || pointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (!hasPropulsion()) { element.classList.add('no-propulsion'); return; }
    event.preventDefault();
    pointer = event.pointerId;
    element.classList.add('is-active');
    try { element.setPointerCapture(pointer); } catch {}
    moveStick(event);
  });
  element?.addEventListener('pointermove', event => {
    if (!enabled || pointer !== event.pointerId) return;
    event.preventDefault();
    moveStick(event);
  });
  const end = event => {
    if (pointer !== event.pointerId) return;
    pointer = null;
    state.move.x = 0;
    state.move.y = 0;
    if (knob) knob.style.transform = 'translate(-50%,-50%)';
    element?.classList.remove('is-active');
  };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => element?.addEventListener(type, end));
  window.addEventListener('blur', reset);

  return Object.freeze({
    isEnabled: () => enabled,
    setEnabled: value => {
      const next = Boolean(value);
      if (enabled === next) {
        if (!next) reset();
        return;
      }
      enabled = next;
      if (!enabled) reset();
    },
    reset
  });
}
