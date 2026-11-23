// Gravidade artificial interna da nave; não substitui a gravidade externa dos planetas.
// O voo agora usa m/s e 1 unidade visual equivale a 1 metro.
const SPEED_TO_WORLD_UNITS = 1;
const MAX_COMPENSATION = 24;

export function createArtificialGravityField({ gravity = 18 } = {}) {
  const baseGravity = Number.isFinite(gravity) ? Math.max(0, gravity) : 18;
  let previousSpeed = null;
  let longitudinalCompensation = 0;
  let warpCompensationActive = false;

  function update(deltaSeconds, propulsionState = {}) {
    const dt = Number.isFinite(deltaSeconds) ? Math.max(0, Math.min(0.05, deltaSeconds)) : 0;
    const speed = Math.max(0, Number(propulsionState.speed) || 0);
    if (previousSpeed !== null && dt > 0) {
      longitudinalCompensation = Math.max(-MAX_COMPENSATION, Math.min(
        MAX_COMPENSATION,
        ((speed - previousSpeed) * SPEED_TO_WORLD_UNITS) / dt
      ));
    } else {
      longitudinalCompensation = 0;
    }
    previousSpeed = speed;
    warpCompensationActive = Boolean(
      propulsionState.warpDriveActive || propulsionState.warpDriveButton ||
      ['entering', 'cruise', 'reducing', 'exiting'].includes(propulsionState.warpTransition)
    );
    return snapshot();
  }

  function getField(position = [0, 0, 0]) {
    const safePosition = Array.isArray(position) && position.length === 3 && position.every(Number.isFinite)
      ? [...position] : [0, 0, 0];
    return Object.freeze({
      position: safePosition,
      // Gravidade vertical constante e força de compensação oposta à aceleração longitudinal.
      uniformAcceleration: [0, -baseGravity, longitudinalCompensation],
      bodies: [],
      warpCompensationActive,
      longitudinalCompensation
    });
  }

  function snapshot() {
    return Object.freeze({
      active: true,
      gravity: baseGravity,
      warpCompensationActive,
      longitudinalCompensation
    });
  }

  function reset() {
    previousSpeed = null;
    longitudinalCompensation = 0;
    warpCompensationActive = false;
  }

  return Object.freeze({ update, getField, snapshot, reset });
}
