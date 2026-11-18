// Adaptador de áudio da nave exploradora.
// Usa exclusivamente o Audio Engine compartilhado; não cria AudioContext próprio.
import { audioCore } from '../systems/audio.js';

const TONES = Object.freeze({
  engineStart: { frequency: 78, endFrequency: 156, duration: 0.42, volume: 0.095, waveform: 'triangle' },
  engineStop: { frequency: 148, endFrequency: 58, duration: 0.34, volume: 0.075, waveform: 'sine' },
  boost: { frequency: 210, endFrequency: 920, duration: 0.24, volume: 0.12, waveform: 'sawtooth' },
  brake: { frequency: 330, endFrequency: 95, duration: 0.18, volume: 0.09, waveform: 'triangle' },
  maneuver: { frequency: 180, endFrequency: 125, duration: 0.11, volume: 0.045, waveform: 'sine' },
  landingAlert: { frequency: 520, endFrequency: 780, duration: 0.22, volume: 0.085, waveform: 'sine' },
  elevator: { frequency: 165, endFrequency: 82, duration: 0.36, volume: 0.085, waveform: 'sine' },
  console: { frequency: 430, endFrequency: 660, duration: 0.095, volume: 0.055, waveform: 'square' },
  mining: { frequency: 620, endFrequency: 240, duration: 0.20, volume: 0.075, waveform: 'triangle' }
});

export function createShipAudio() {
  let disposed = false;
  let engineActive = false;
  let boostActive = false;
  let brakeActive = false;
  let maneuverCooldown = 0;

  function play(name, overrides = {}) {
    if (disposed || !audioCore.isUnlocked || !TONES[name]) return false;
    return audioCore.playTone({ ...TONES[name], ...overrides, bus: 'sfx' });
  }

  async function unlock() {
    if (disposed) return false;
    try {
      return await audioCore.unlock();
    } catch (error) {
      console.warn('[Star Frontier Ship Audio] Áudio indisponível:', error);
      return false;
    }
  }

  function updateFlight({ throttle = false, boosting = false, braking = false, moveX = 0, moveY = 0, dt = 0 } = {}) {
    if (disposed) return;
    const engineRequested = Boolean(throttle || boosting);
    if (engineRequested !== engineActive) {
      play(engineRequested ? 'engineStart' : 'engineStop');
      engineActive = engineRequested;
    }
    if (Boolean(boosting) !== boostActive) {
      if (boosting) play('boost');
      boostActive = Boolean(boosting);
    }
    if (Boolean(braking) !== brakeActive) {
      if (braking) play('brake');
      brakeActive = Boolean(braking);
    }
    maneuverCooldown = Math.max(0, maneuverCooldown - Math.max(0, dt));
    const maneuvering = Math.abs(moveX) + Math.abs(moveY) > 0.16;
    if (engineRequested && maneuvering && maneuverCooldown <= 0) {
      play('maneuver');
      maneuverCooldown = 0.85;
    }
  }

  function resetFlight() {
    engineActive = false;
    boostActive = false;
    brakeActive = false;
    maneuverCooldown = 0;
  }

  function dispose() {
    disposed = true;
    resetFlight();
  }

  return Object.freeze({
    unlock,
    updateFlight,
    resetFlight,
    dispose,
    playLandingAlert: () => play('landingAlert'),
    playElevator: () => play('elevator'),
    playConsole: () => play('console'),
    playMining: () => play('mining')
  });
}
