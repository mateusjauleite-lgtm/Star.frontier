// Áudio do personagem principal (Character 1).
// Usa o núcleo compartilhado e efeitos procedurais; não depende do NPC/Character futuro.
import { audioCore } from '../systems/audio.js';
import { on } from '../core/events.js';

const TONES = Object.freeze({
  footstep: { frequency: 118, endFrequency: 72, duration: 0.075, volume: 0.075, waveform: 'triangle' },
  jump: { frequency: 250, endFrequency: 510, duration: 0.18, volume: 0.10, waveform: 'sine' },
  land: { frequency: 105, endFrequency: 48, duration: 0.19, volume: 0.13, waveform: 'triangle' },
  equip: { frequency: 480, endFrequency: 820, duration: 0.12, volume: 0.075, waveform: 'square' },
  phaser: { frequency: 760, endFrequency: 135, duration: 0.23, volume: 0.15, waveform: 'sawtooth' },
  interact: { frequency: 390, endFrequency: 590, duration: 0.10, volume: 0.065, waveform: 'sine' },
  elevator: { frequency: 170, endFrequency: 78, duration: 0.34, volume: 0.085, waveform: 'sine' },
  seat: { frequency: 220, endFrequency: 335, duration: 0.15, volume: 0.07, waveform: 'sine' }
});

export function createCharacterAudio(options = {}) {
  const core = options.core || null;
  let detachEvents = [];
  let footstepSide = 0;
  let disposed = false;

  function play(name, overrides = {}) {
    if (disposed || !TONES[name] || !audioCore.isUnlocked) return false;
    return audioCore.playTone({ ...TONES[name], ...overrides, bus: 'sfx' });
  }

  async function unlock() {
    if (disposed) return false;
    try {
      return await audioCore.unlock();
    } catch (error) {
      console.warn('[Star Frontier Character Audio] Áudio indisponível:', error);
      return false;
    }
  }

  function attach(characterCore = core) {
    detach();
    if (!characterCore) return false;

    let previousGrounded = characterCore.snapshot().grounded;
    let previousMode = characterCore.snapshot().mode;

    const offGrounded = on('character:grounded-changed', snapshot => {
      const grounded = Boolean(snapshot?.grounded);
      if (!previousGrounded && grounded) play('land');
      previousGrounded = grounded;
    });

    const offMode = on('character:mode-changed', snapshot => {
      const mode = snapshot?.mode;
      if (mode && mode !== previousMode) play('seat');
      previousMode = mode || previousMode;
    });

    if (typeof offGrounded === 'function') detachEvents.push(offGrounded);
    if (typeof offMode === 'function') detachEvents.push(offMode);
    return true;
  }

  function detach() {
    for (const unsubscribe of detachEvents) {
      try { unsubscribe(); } catch {}
    }
    detachEvents = [];
  }

  function dispose() {
    detach();
    disposed = true;
  }

  return Object.freeze({
    unlock,
    attach,
    detach,
    dispose,
    playFootstep() {
      footstepSide ^= 1;
      return play('footstep', {
        frequency: footstepSide ? 118 : 136,
        endFrequency: footstepSide ? 72 : 84
      });
    },
    playJump: () => play('jump'),
    playLand: () => play('land'),
    playEquip: () => play('equip'),
    playPhaser: () => play('phaser'),
    playInteract: () => play('interact'),
    playElevator: () => play('elevator'),
    playSeat: () => play('seat')
  });
}
