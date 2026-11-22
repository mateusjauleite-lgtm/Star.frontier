const MOVEMENT = Object.freeze({
  forward: { x: 0, y: 1 },
  backward: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Runtime do corpo físico da Alexia.
 * O ator tem núcleo físico próprio; a IA é injetada pelo Ship Computer.
 */
export function createAlexiaCrewRuntimeSystem({
  getActor,
  floorY = 8.91,
  moveSpeed = 2.2,
  defaultMoveDuration = 2
} = {}) {
  if (typeof getActor !== 'function') {
    throw new TypeError('A fábrica do corpo físico da Alexia não foi fornecida.');
  }

  let actor = null;
  let ai = null;
  let moveTimeRemaining = 0;
  let crewController = null;

  function stop() {
    moveTimeRemaining = 0;
    actor?.core?.setMovement?.(0, 0);
    return { accepted: Boolean(actor), moving: false };
  }

  function move({ direction, durationSeconds = defaultMoveDuration } = {}) {
    const vector = MOVEMENT[direction];
    if (!actor || !vector) return { accepted: false, reason: 'invalid-actor-or-direction' };
    const duration = Number(durationSeconds);
    if (!Number.isFinite(duration) || duration <= 0) {
      return { accepted: false, reason: 'invalid-duration' };
    }

    actor.core.setMovement(vector.x, vector.y);
    const yaw = Math.atan2(-vector.x, -vector.y);
    actor.group.rotation.y = yaw;
    moveTimeRemaining = clamp(duration, 0.1, 8);
    return { accepted: true, direction, durationSeconds: moveTimeRemaining };
  }

  function getSnapshot() {
    if (!actor) return { id: 'character:alexia', status: 'offline', moving: false };
    const state = actor.getSnapshot();
    return {
      id: 'character:alexia',
      status: 'online',
      moving: moveTimeRemaining > 0,
      position: {
        x: actor.group.position.x,
        y: actor.group.position.y,
        z: actor.group.position.z
      },
      character: state
    };
  }

  crewController = Object.freeze({
    id: 'character:alexia',
    getSnapshot,
    move,
    stop
  });

  return {
    priority: 40,
    initialize(context = {}) {
      actor = getActor();
      if (!actor || !actor.group || !actor.core ||
          typeof actor.initialize !== 'function' || typeof actor.update !== 'function') {
        throw new TypeError('O corpo físico independente da Alexia não está disponível.');
      }

      actor.initialize();
      ai = context.shipComputerAI || null;
      ai?.bindCrewController?.(crewController);
      context.alexiaCrew = crewController;
    },
    update(deltaSeconds) {
      if (!actor) return;
      const dt = Math.max(0, Number(deltaSeconds) || 0);
      if (moveTimeRemaining > 0) {
        const state = actor.core.snapshot();
        const movement = state.movement || { x: 0, y: 0 };
        const magnitude = Math.hypot(movement.x, movement.y);
        if (magnitude > 0) {
          const x = movement.x / Math.max(1, magnitude);
          const y = movement.y / Math.max(1, magnitude);
          actor.group.position.x += x * moveSpeed * dt;
          actor.group.position.z -= y * moveSpeed * dt;
        }
        moveTimeRemaining = Math.max(0, moveTimeRemaining - dt);
        if (moveTimeRemaining === 0) stop();
      }
      actor.update(dt, { position: actor.group.position, floorY });
    },
    shutdown(context = {}) {
      stop();
      ai?.bindCrewController?.(null);
      if (context.alexiaCrew === crewController) delete context.alexiaCrew;
      actor?.dispose?.();
      actor = null;
      ai = null;
    }
  };
}
