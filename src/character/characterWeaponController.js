// Controle isolado da postura de combate do Phaser.
// Atua de forma aditiva após o animator, preservando caminhada, corrida e física.
import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;
const smooth = value => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

export function createCharacterWeaponController(model) {
  if (!model?.parts) throw new TypeError('Modelo de personagem inválido.');
  const p = model.parts;
  let aimRequested = false;
  let aimBlend = 0;
  let shotRemaining = 0;
  let state = 'lowered';

  function setAiming(value) {
    aimRequested = Boolean(value);
    return aimRequested;
  }

  function toggleAiming() {
    return setAiming(!aimRequested);
  }

  function fire() {
    shotRemaining = 0.24;
    return true;
  }

  function update(deltaSeconds, lookPitch = 0) {
    const dt = clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.05);
    shotRemaining = Math.max(0, shotRemaining - dt);
    const target = aimRequested || shotRemaining > 0 ? 1 : 0;
    aimBlend = THREE.MathUtils.damp(aimBlend, target, 11, dt);
    const aim = smooth(aimBlend);
    const pitch = clamp(Number.isFinite(lookPitch) ? lookPitch : 0, -0.65, 0.65);
    const pitchOffset = pitch * 0.34;
    const recoil = shotRemaining > 0 ? Math.sin((shotRemaining / 0.24) * Math.PI) : 0;

    // Soma sobre a pose produzida pelo animator neste frame.
    if (p.rightUpperArm) p.rightUpperArm.rotation.x += aim * (0.88 - pitchOffset) + recoil * 0.10;
    if (p.rightElbow) p.rightElbow.rotation.x += aim * 0.42 + recoil * 0.12;
    if (p.rightForearm) p.rightForearm.rotation.x += aim * 0.18 - recoil * 0.18;

    // Braço esquerdo acompanha a arma como apoio, sem alterar a hierarquia do rig.
    if (p.leftUpperArm) p.leftUpperArm.rotation.x += aim * (0.72 - pitchOffset * 0.55);
    if (p.leftUpperArm) p.leftUpperArm.rotation.z += aim * -0.20;
    if (p.leftElbow) p.leftElbow.rotation.x += aim * 0.52;
    if (p.leftForearm) p.leftForearm.rotation.x += aim * 0.12;

    state = shotRemaining > 0 ? 'firing' : aimBlend > 0.04 ? 'aiming' : 'lowered';
    return { state, aiming: aimRequested, blend: aim, firing: shotRemaining > 0 };
  }

  function reset() {
    aimRequested = false;
    aimBlend = 0;
    shotRemaining = 0;
    state = 'lowered';
  }

  return Object.freeze({
    setAiming,
    toggleAiming,
    fire,
    update,
    reset,
    get state() { return state; },
    get aiming() { return aimRequested; }
  });
}
