// Animações procedurais humanas do Star Frontier.
// Estados de locomoção e ações aéreas ficam prontos para a integração física da etapa 3.
import * as THREE from 'three';

const clamp01 = value => Math.max(0, Math.min(1, value));
const smooth = value => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const lerp = THREE.MathUtils.lerp;

const POSES = ['idle', 'walk', 'run', 'jump', 'fall', 'land', 'sit', 'stand'];
const ONE_SHOT = { jump: 0.46, land: 0.30 };

/**
 * Controlador procedural para o rig de characterModel.js.
 * update(deltaSeconds) deve ser chamado no loop de renderização.
 * jump/fall/land são estados visuais; a gravidade e o deslocamento vertical
 * continuam sob responsabilidade do controlador físico da etapa 3.
 */
export function createCharacterAnimator(model) {
  if (!model?.parts) throw new TypeError('Modelo de personagem inválido.');

  const p = model.parts;
  const rotationParts = [
    'leftShoulder', 'rightShoulder',
    'leftUpperArm', 'rightUpperArm',
    'leftElbow', 'rightElbow',
    'leftForearm', 'rightForearm',
    'leftHip', 'rightHip',
    'leftThigh', 'rightThigh',
    'leftKnee', 'rightKnee',
    'leftShin', 'rightShin',
    'leftAnkle', 'rightAnkle',
    'torso', 'head'
  ];
  const base = {};
  for (const key of rotationParts) {
    if (p[key]?.rotation) base[key] = p[key].rotation.clone();
  }
  const pelvisBaseY = p.pelvis.position.y;
  const pelvisBaseRotation = p.pelvis.rotation.clone();

  let current = 'idle';
  let previous = 'idle';
  let transition = 1;
  let elapsed = 0;
  let phase = 0;

  function play(name, options = {}) {
    if (!POSES.includes(name)) throw new TypeError('Animação desconhecida: ' + name);
    if (name === current && !options.restart) return;
    previous = current;
    current = name;
    transition = 0;
    elapsed = 0;
  }

  function applyPose(name, time, stateElapsed) {
    const isWalk = name === 'walk';
    const isRun = name === 'run';
    const moving = isWalk || isRun;
    const speed = isRun ? 11.5 : 7.2;
    const amplitude = isRun ? 0.62 : 0.43;
    const swing = Math.sin(time * speed);
    const opposite = -swing;
    const liftLeft = Math.max(0, -swing);
    const liftRight = Math.max(0, swing);
    const bounce = Math.abs(Math.sin(time * speed));

    const pose = {};
    for (const key of rotationParts) pose[key] = 0;
    pose.pelvisY = pelvisBaseY;
    pose.pelvisX = 0;

    if (moving) {
      pose.leftThigh = swing * amplitude;
      pose.rightThigh = opposite * amplitude;
      pose.leftShin = liftLeft * (isRun ? 0.88 : 0.58);
      pose.rightShin = liftRight * (isRun ? 0.88 : 0.58);
      pose.leftUpperArm = -swing * (isRun ? 0.48 : 0.34);
      pose.rightUpperArm = swing * (isRun ? 0.48 : 0.34);
      pose.leftForearm = -0.16 - (isRun ? 0.10 : 0.04);
      pose.rightForearm = -0.16 - (isRun ? 0.10 : 0.04);
      pose.leftElbow = -0.12;
      pose.rightElbow = -0.12;
      pose.torso = isRun ? -0.10 : -0.045;
      pose.head = 0.015;
      pose.pelvisY += isRun ? bounce * 0.045 : bounce * 0.018;
      pose.pelvisX = Math.sin(time * speed * 0.5) * 0.018;
    } else if (name === 'jump') {
      const t = clamp01(stateElapsed / ONE_SHOT.jump);
      const anticipation = 1 - smooth(t / 0.22);
      const tuck = smooth((t - 0.12) / 0.48);
      pose.leftThigh = -0.72 * tuck - 0.18 * anticipation;
      pose.rightThigh = -0.72 * tuck - 0.18 * anticipation;
      pose.leftShin = 0.88 * tuck;
      pose.rightShin = 0.88 * tuck;
      pose.leftUpperArm = 0.82 * (1 - 0.35 * tuck);
      pose.rightUpperArm = 0.82 * (1 - 0.35 * tuck);
      pose.leftForearm = -0.28;
      pose.rightForearm = -0.28;
      pose.leftElbow = -0.25;
      pose.rightElbow = -0.25;
      pose.torso = -0.12 + 0.20 * tuck;
      pose.head = -0.06;
      pose.pelvisY += -0.045 * anticipation;
      pose.pelvisX = -0.08 * anticipation;
    } else if (name === 'fall') {
      pose.leftThigh = -0.16;
      pose.rightThigh = -0.16;
      pose.leftShin = 0.20;
      pose.rightShin = 0.20;
      pose.leftUpperArm = 0.48;
      pose.rightUpperArm = 0.48;
      pose.leftForearm = -0.22;
      pose.rightForearm = -0.22;
      pose.leftElbow = -0.18;
      pose.rightElbow = -0.18;
      pose.torso = 0.12;
      pose.head = -0.08;
    } else if (name === 'land') {
      const recover = smooth(stateElapsed / ONE_SHOT.land);
      const impact = Math.sin(Math.PI * clamp01(stateElapsed / ONE_SHOT.land));
      pose.leftThigh = lerp(-0.46, 0, recover);
      pose.rightThigh = lerp(-0.46, 0, recover);
      pose.leftShin = lerp(0.58, 0, recover);
      pose.rightShin = lerp(0.58, 0, recover);
      pose.leftUpperArm = lerp(0.42, 0, recover);
      pose.rightUpperArm = lerp(0.42, 0, recover);
      pose.torso = 0.16 * impact;
      pose.pelvisY -= 0.10 * impact;
    } else if (name === 'sit') {
      pose.leftThigh = -1.18;
      pose.rightThigh = -1.18;
      pose.leftShin = 1.32;
      pose.rightShin = 1.32;
      pose.leftUpperArm = -0.72;
      pose.rightUpperArm = -0.72;
      pose.leftForearm = -0.28;
      pose.rightForearm = -0.28;
      pose.torso = -0.10;
      pose.pelvisY += 0.12;
    } else if (name === 'stand') {
      pose.torso = -0.025;
    } else {
      // Idle: pequenas variações respiratórias, sem deslocar o ponto de apoio.
      const breath = Math.sin(time * 1.65);
      pose.torso = breath * 0.012;
      pose.head = Math.sin(time * 0.8) * 0.008;
      pose.leftUpperArm = -0.025;
      pose.rightUpperArm = -0.025;
      pose.leftForearm = -0.08;
      pose.rightForearm = -0.08;
    }

    // Tornozelos compensam a rotação das pernas e mantêm os pés mais estáveis.
    pose.leftAnkle = -pose.leftShin * 0.32 - pose.leftThigh * 0.08;
    pose.rightAnkle = -pose.rightShin * 0.32 - pose.rightThigh * 0.08;
    pose.leftShoulder = pose.leftUpperArm * 0.12;
    pose.rightShoulder = pose.rightUpperArm * 0.12;
    pose.leftHip = 0;
    pose.rightHip = 0;
    pose.leftKnee = 0;
    pose.rightKnee = 0;
    return pose;
  }

  function apply(pose) {
    for (const key of rotationParts) {
      const target = p[key];
      if (target?.rotation && Number.isFinite(pose[key])) {
        target.rotation.set(
          base[key].x + pose[key],
          base[key].y,
          base[key].z
        );
      }
    }
    p.pelvis.position.y = pose.pelvisY ?? pelvisBaseY;
    p.pelvis.rotation.set(
      pelvisBaseRotation.x + (pose.pelvisX ?? 0),
      pelvisBaseRotation.y,
      pelvisBaseRotation.z
    );
  }

  function update(deltaSeconds) {
    const dt = THREE.MathUtils.clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.05);
    elapsed += dt;
    phase += dt;
    if (transition < 1) transition = Math.min(1, transition + dt / 0.20);

    const blend = smooth(transition);
    const oldPose = applyPose(previous, phase, 0);
    const newPose = applyPose(current, phase, elapsed);
    const mixed = {};
    for (const key of Object.keys(newPose)) {
      mixed[key] = lerp(oldPose[key] ?? 0, newPose[key] ?? 0, blend);
    }
    apply(mixed);

    // Ação curta de salto prepara automaticamente a pose de queda.
    if (current === 'jump' && elapsed >= ONE_SHOT.jump) play('fall');
    // A aterrissagem termina em idle; o controlador físico decide quando chamá-la.
    if (current === 'land' && elapsed >= ONE_SHOT.land) play('idle');

    return { animation: current, previous, transition: blend, elapsed };
  }

  function reset() {
    current = 'idle';
    previous = 'idle';
    transition = 1;
    elapsed = 0;
    phase = 0;
    for (const key of rotationParts) {
      if (p[key]?.rotation && base[key]) p[key].rotation.copy(base[key]);
    }
    p.pelvis.position.y = pelvisBaseY;
    p.pelvis.rotation.copy(pelvisBaseRotation);
  }

  return Object.freeze({
    play,
    update,
    reset,
    get current() { return current; },
    get available() { return [...POSES]; }
  });
}
