// Física do personagem no referencial local da nave, independente do modelo e do HUD.
const GRAVITY = 18;
const JUMP_SPEED = 5.6;
const MAX_FALL_SPEED = 24;
const MAX_LATERAL_SPEED = 24;
const EPSILON = 0.001;

export function createCharacterPhysics(options = {}) {
  const gravity = Number.isFinite(options.gravity) ? Math.max(0, options.gravity) : GRAVITY;
  const jumpSpeed = Number.isFinite(options.jumpSpeed) ? Math.max(0, options.jumpSpeed) : JUMP_SPEED;
  const maxFallSpeed = Number.isFinite(options.maxFallSpeed) ? Math.max(0, options.maxFallSpeed) : MAX_FALL_SPEED;
  const maxLateralSpeed = Number.isFinite(options.maxLateralSpeed) ? Math.max(0, options.maxLateralSpeed) : MAX_LATERAL_SPEED;
  const gravityKernel = options.gravityKernel ?? null;

  let velocityX = 0;
  let velocityY = 0;
  let velocityZ = 0;
  let grounded = true;
  let justLanded = false;

  function reset(height = 0) {
    velocityX = 0;
    velocityY = 0;
    velocityZ = 0;
    grounded = true;
    justLanded = false;
    return { grounded, velocityY, y: height };
  }

  function jump() {
    if (!grounded) return false;
    velocityX = 0;
    velocityY = jumpSpeed;
    velocityZ = 0;
    grounded = false;
    justLanded = false;
    return true;
  }

  function leaveGround() {
    if (!grounded) return false;
    grounded = false;
    velocityX = 0;
    velocityY = 0;
    velocityZ = 0;
    justLanded = false;
    return true;
  }

  function update(deltaSeconds, { position, floorY, gravityField = null } = {}) {
    if (!position || !Number.isFinite(position.y) || !Number.isFinite(floorY)) {
      throw new TypeError('A física do personagem exige posição e altura do piso válidas.');
    }
    const dt = Math.min(0.05, Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0));
    justLanded = false;

    if (grounded) {
      position.y = floorY;
      velocityX = 0;
      velocityY = 0;
      velocityZ = 0;
    } else {
      const fieldPosition = gravityField?.position ?? [position.x || 0, position.y, position.z || 0];
      const uniformAcceleration = gravityField?.uniformAcceleration ?? [0, -gravity, 0];
      const acceleration = gravityKernel?.acceleration?.({
        position: fieldPosition,
        uniformAcceleration,
        bodies: gravityField?.bodies ?? []
      }) ?? uniformAcceleration;
      const ax = Number.isFinite(acceleration?.[0]) ? acceleration[0] : 0;
      const ay = Number.isFinite(acceleration?.[1]) ? acceleration[1] : -gravity;
      const az = Number.isFinite(acceleration?.[2]) ? acceleration[2] : 0;

      const integrated = gravityKernel?.integrateVelocity?.(
        [velocityX, velocityY, velocityZ], [ax, ay, az], dt, maxFallSpeed
      );
      if (Array.isArray(integrated) && integrated.length >= 3 && integrated.every(Number.isFinite)) {
        velocityX = clamp(integrated[0], -maxLateralSpeed, maxLateralSpeed);
        velocityY = clamp(integrated[1], -maxFallSpeed, maxFallSpeed);
        velocityZ = clamp(integrated[2], -maxLateralSpeed, maxLateralSpeed);
      } else {
        velocityX = clamp(velocityX + ax * dt, -maxLateralSpeed, maxLateralSpeed);
        velocityY = clamp(velocityY + ay * dt, -maxFallSpeed, maxFallSpeed);
        velocityZ = clamp(velocityZ + az * dt, -maxLateralSpeed, maxLateralSpeed);
      }

      if (Number.isFinite(position.x)) position.x += velocityX * dt;
      if (Number.isFinite(position.z)) position.z += velocityZ * dt;
      const nextY = position.y + velocityY * dt;
      if (nextY <= floorY + EPSILON && velocityY <= 0) {
        position.y = floorY;
        velocityX = 0;
        velocityY = 0;
        velocityZ = 0;
        grounded = true;
        justLanded = true;
      } else {
        position.y = nextY;
      }
    }

    return Object.freeze({
      grounded,
      velocityX,
      velocityY,
      velocityZ,
      justLanded,
      y: position.y
    });
  }

  return Object.freeze({
    reset,
    jump,
    leaveGround,
    update,
    get grounded() { return grounded; },
    get velocityY() { return velocityY; },
    get velocity() { return Object.freeze([velocityX, velocityY, velocityZ]); }
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}
