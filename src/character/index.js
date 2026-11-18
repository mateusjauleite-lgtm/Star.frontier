/**
 * Fachada do subsistema de personagem.
 * Reúne lógica, modelo Three.js, animação, física, arma e adaptador de áudio.
 */
import { createCharacterCore } from './characterCore.js';
import { createCharacterModel } from './characterModel.js';
import { createCharacterAnimator } from './characterAnimator.js';
import { createCharacterPhysics } from './characterPhysics.js';
import { createCharacterWeaponController } from './characterWeaponController.js';
import { createCharacterAudio } from './characterAudio.js';

export function createCharacterSystem(options = {}) {
  const model = createCharacterModel(options.model);
  const core = createCharacterCore(options.initialState);
  const animator = createCharacterAnimator(model);
  const physics = createCharacterPhysics(options.physics);
  const weapon = createCharacterWeaponController(model);
  const audio = createCharacterAudio(options.audio);

  let initialized = false;
  let lastGrounded = true;

  function initialize() {
    if (initialized) return getSnapshot();
    initialized = true;
    physics.reset(options.initialHeight ?? 0);
    audio.attach();
    core.initialize();
    return getSnapshot();
  }

  function update(deltaSeconds, environment = {}) {
    if (!initialized) initialize();

    const snapshot = core.snapshot();
    const movement = snapshot.movement;
    const moving = Math.hypot(movement.x, movement.y) > 0.12;

    if (snapshot.mode === 'on-foot') {
      if (!snapshot.grounded) {
        animator.play('fall');
      } else if (moving) {
        animator.play('walk');
      } else {
        animator.play(snapshot.posture === 'seated' ? 'sit' : 'idle');
      }
    } else {
      animator.play('sit');
    }

    const physicsState = environment.position && Number.isFinite(environment.floorY)
      ? physics.update(deltaSeconds, environment)
      : { grounded: physics.grounded, velocityY: physics.velocityY, justLanded: false };

    if (physicsState.grounded !== lastGrounded) {
      lastGrounded = physicsState.grounded;
      core.setGrounded(lastGrounded);
    }

    if (physicsState.justLanded) animator.play('land', { restart: true });
    animator.update(deltaSeconds);
    const weaponState = weapon.update(deltaSeconds, snapshot.look.x);

    return {
      character: core.snapshot(),
      physics: physicsState,
      animation: animator.current,
      weapon: weaponState
    };
  }

  function jump() {
    if (!initialized) initialize();
    if (core.snapshot().mode !== 'on-foot') return false;
    const started = physics.jump();
    if (started) {
      lastGrounded = false;
      core.setGrounded(false);
      animator.play('jump', { restart: true });
    }
    return started;
  }

  function setMode(mode) {
    if (!initialized) initialize();
    const result = core.setMode(mode);
    if (mode === 'on-foot') {
      lastGrounded = true;
      physics.reset();
      core.setGrounded(true);
      animator.play('stand', { restart: true });
    } else {
      physics.reset();
      animator.play('sit', { restart: true });
    }
    return result;
  }

  function setEquipment(slot, itemId) {
    const snapshot = core.setEquipment(slot, itemId);
    if (slot === 'weapon') model.setEquipment('weapon', itemId);
    else if (['head', 'torso', 'legs', 'hands', 'feet', 'back'].includes(slot)) {
      model.setEquipment(slot, itemId);
    }
    return snapshot;
  }

  function fire() {
    if (!initialized) initialize();
    if (core.snapshot().mode !== 'on-foot') return false;
    weapon.fire();
    audio.playAction('weaponFire');
    return true;
  }

  function getSnapshot() {
    return {
      ...core.snapshot(),
      animation: animator.current,
      weaponState: weapon.state,
      equipmentVisual: model.getEquipment()
    };
  }

  function dispose() {
    audio.dispose();
    weapon.reset();
    animator.reset();
    initialized = false;
  }

  return Object.freeze({
    group: model.group,
    model,
    core,
    physics,
    animator,
    weapon,
    audio,
    initialize,
    update,
    jump,
    setMode,
    setEquipment,
    setMovement: core.setMovement,
    setLook: core.setLook,
    setHealth: core.setHealth,
    setStamina: core.setStamina,
    setInteractionTarget: core.setInteractionTarget,
    setAiming: weapon.setAiming,
    fire,
    getSnapshot,
    dispose
  });
}
