// Física vertical básica do personagem — independente do modelo e do HUD.
// A posição recebida usa o referencial local da nave.
const GRAVITY = 18;
const JUMP_SPEED = 5.6;
const MAX_FALL_SPEED = 24;
const EPSILON = 0.001;

export function createCharacterPhysics(options = {}) {
  const gravity = Number.isFinite(options.gravity) ? Math.max(0, options.gravity) : GRAVITY;
  const jumpSpeed = Number.isFinite(options.jumpSpeed) ? Math.max(0, options.jumpSpeed) : JUMP_SPEED;
  const maxFallSpeed = Number.isFinite(options.maxFallSpeed)
    ? Math.max(0, options.maxFallSpeed)
    : MAX_FALL_SPEED;

  let velocityY = 0;
  let grounded = true;
  let justLanded = false;

  function reset(height = 0) {
    velocityY = 0;
    grounded = true;
    justLanded = false;
    return { grounded, velocityY, y: height };
  }

  function jump() {
    if (!grounded) return false;
    velocityY = jumpSpeed;
    grounded = false;
    justLanded = false;
    return true;
  }

  function update(deltaSeconds, { position, floorY } = {}) {
    if (!position || !Number.isFinite(position.y) || !Number.isFinite(floorY)) {
      throw new TypeError('A física do personagem exige posição e altura do piso válidas.');
    }

    const dt = Math.min(0.05, Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0));
    justLanded = false;

    if (grounded) {
      // O convés pode mudar de altura durante o elevador; nesse caso a
      // chamada reset() reposiciona o estado sem gerar queda artificial.
      position.y = floorY;
      velocityY = 0;
    } else {
      velocityY = Math.max(-maxFallSpeed, velocityY - gravity * dt);
      const nextY = position.y + velocityY * dt;

      if (nextY <= floorY + EPSILON && velocityY <= 0) {
        position.y = floorY;
        velocityY = 0;
        grounded = true;
        justLanded = true;
      } else {
        position.y = nextY;
      }
    }

    return Object.freeze({ grounded, velocityY, justLanded, y: position.y });
  }

  return Object.freeze({
    reset,
    jump,
    update,
    get grounded() { return grounded; },
    get velocityY() { return velocityY; }
  });
}
