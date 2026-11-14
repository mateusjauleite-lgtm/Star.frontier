// Animações procedurais iniciais do personagem.
// Não depende de AnimationMixer nem de arquivos externos de modelo.
import * as THREE from 'three';

const clamp01 = value => Math.max(0, Math.min(1, value));
const smooth = value => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

const POSES = ['idle', 'walk', 'run', 'sit', 'stand'];

/**
 * Controlador simples de animação para o rig de characterModel.js.
 * update(deltaSeconds) deve ser chamado no loop de renderização.
 */
export function createCharacterAnimator(model) {
  if (!model?.parts) throw new TypeError('Modelo de personagem inválido.');

  const p = model.parts;
  let current = 'idle';
  let previous = 'idle';
  let transition = 1;
  let elapsed = 0;
  let phase = 0;

  const base = {
    leftUpperArm: p.leftUpperArm.rotation.clone(),
    rightUpperArm: p.rightUpperArm.rotation.clone(),
    leftForearm: p.leftForearm.rotation.clone(),
    rightForearm: p.rightForearm.rotation.clone(),
    leftThigh: p.leftThigh.rotation.clone(),
    rightThigh: p.rightThigh.rotation.clone(),
    leftShin: p.leftShin.rotation.clone(),
    rightShin: p.rightShin.rotation.clone(),
    torso: p.torso.rotation.clone(),
    head: p.head.rotation.clone()
  };

  function play(name, options = {}) {
    if (!POSES.includes(name)) {
      throw new TypeError('Animação desconhecida: ' + name);
    }
    if (name === current && !options.restart) return;
    previous = current;
    current = name;
    transition = 0;
    elapsed = 0;
  }

  function applyPose(name, time) {
    const walk = name === 'walk' ? 1 : name === 'run' ? 1.55 : 0;
    const seated = name === 'sit';
    const standing = name === 'stand';

    const swing = Math.sin(time * (name === 'run' ? 12 : 7.5));
    const bounce = Math.abs(Math.sin(time * (name === 'run' ? 12 : 7.5)));

    const pose = {
      leftThigh: seated ? -1.18 : swing * 0.48 * walk,
      rightThigh: seated ? -1.18 : -swing * 0.48 * walk,
      leftShin: seated ? 1.32 : Math.max(0, -swing) * 0.72 * walk,
      rightShin: seated ? 1.32 : Math.max(0, swing) * 0.72 * walk,
      leftUpperArm: seated ? -0.95 : -swing * 0.38 * walk,
      rightUpperArm: seated ? -0.95 : swing * 0.38 * walk,
      leftForearm: seated ? -0.35 : -0.12,
      rightForearm: seated ? -0.35 : -0.12,
      torso: seated ? -0.12 : (standing ? 0 : -bounce * 0.018 * walk),
      head: 0,
      pelvisY: seated ? 0.72 : (name === 'run' ? bounce * 0.035 : 0)
    };

    return pose;
  }

  function apply(pose, weight) {
    const blend = (baseValue, target) => THREE.MathUtils.lerp(baseValue, target, weight);
    p.leftThigh.rotation.x = blend(base.leftThigh.x, pose.leftThigh);
    p.rightThigh.rotation.x = blend(base.rightThigh.x, pose.rightThigh);
    p.leftShin.rotation.x = blend(base.leftShin.x, pose.leftShin);
    p.rightShin.rotation.x = blend(base.rightShin.x, pose.rightShin);
    p.leftUpperArm.rotation.x = blend(base.leftUpperArm.x, pose.leftUpperArm);
    p.rightUpperArm.rotation.x = blend(base.rightUpperArm.x, pose.rightUpperArm);
    p.leftForearm.rotation.x = blend(base.leftForearm.x, pose.leftForearm);
    p.rightForearm.rotation.x = blend(base.rightForearm.x, pose.rightForearm);
    p.torso.rotation.x = blend(base.torso.x, pose.torso);
    p.head.rotation.x = blend(base.head.x, pose.head);
    p.pelvis.position.y = THREE.MathUtils.lerp(0.91, pose.pelvisY ?? 0.91, weight);
  }

  function update(deltaSeconds) {
    const dt = THREE.MathUtils.clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.05);
    elapsed += dt;
    phase += dt;

    if (transition < 1) transition = Math.min(1, transition + dt / 0.22);

    const blend = smooth(transition);
    const oldPose = applyPose(previous, phase);
    const newPose = applyPose(current, phase);
    const keys = Object.keys(newPose);
    const mixed = {};

    for (const key of keys) {
      mixed[key] = THREE.MathUtils.lerp(oldPose[key], newPose[key], blend);
    }

    apply(mixed, 1);
    return { animation: current, previous, transition: blend, elapsed };
  }

  function reset() {
    play('idle', { restart: true });
    phase = 0;
    p.pelvis.position.y = 0.91;
    for (const [key, value] of Object.entries(base)) {
      const target = p[key];
      target.rotation.copy(value);
    }
  }

  return Object.freeze({
    play,
    update,
    reset,
    get current() { return current; },
    get available() { return [...POSES]; }
  });
}
