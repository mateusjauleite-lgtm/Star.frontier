// Adaptador de áudio da nave exploradora.
// Usa exclusivamente o Audio Engine compartilhado; não cria AudioContext próprio.
// Os tons longos e suaves são uma camada provisória até a entrada de assets reais.

const TONES = Object.freeze({
  engineStart: { frequency: 58, endFrequency: 92, duration: 0.72, attack: 0.12, volume: 0.045, waveform: 'sine' },
  engineStop: { frequency: 88, endFrequency: 42, duration: 0.58, attack: 0.08, volume: 0.035, waveform: 'sine' },
  engineBed: { frequency: 58, endFrequency: 72, duration: 1.65, attack: 0.22, volume: 0.026, waveform: 'triangle' },
  nacelleHum: { frequency: 112, endFrequency: 104, duration: 1.45, attack: 0.24, volume: 0.012, waveform: 'sine' },
  boost: { frequency: 74, endFrequency: 118, duration: 0.62, attack: 0.055, volume: 0.075, waveform: 'triangle' },
  brake: { frequency: 185, endFrequency: 68, duration: 0.30, attack: 0.025, volume: 0.045, waveform: 'sine' },
  maneuver: { frequency: 92, endFrequency: 68, duration: 0.24, attack: 0.035, volume: 0.022, waveform: 'sine' },
  landingAlert: { frequency: 520, endFrequency: 660, duration: 0.22, volume: 0.065, waveform: 'sine' },
  elevator: { frequency: 125, endFrequency: 66, duration: 0.42, volume: 0.065, waveform: 'sine' },
  console: { frequency: 430, endFrequency: 590, duration: 0.095, volume: 0.045, waveform: 'sine' },
  mining: { frequency: 280, endFrequency: 150, duration: 0.24, volume: 0.055, waveform: 'triangle' }
});


export function createShipAudio() {
  let disposed = false;
  let engineActive = false;
  let boostActive = false;
  let brakeActive = false;
  let maneuverCooldown = 0;
  let engineBedTimer = 0;
  let nacelleHumTimer = 0;

  function play(name, overrides = {}) {
    if (disposed || !audioCore.isUnlocked || !TONES[name]) return false;
    return audioCore.playTone({ ...TONES[name], ...overrides, bus: 'ambience' === name ? 'ambience' : 'sfx' });
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

  function updateFlight({
    throttle = false, boosting = false, braking = false,
    nacellesLit = false, moveX = 0, moveY = 0, dt = 0
  } = {}) {
    if (disposed) return;
    const delta = Math.max(0, Math.min(0.08, Number(dt) || 0));
    const engineRequested = Boolean(throttle || boosting);

    if (engineRequested !== engineActive) {
      play(engineRequested ? 'engineStart' : 'engineStop');
      engineActive = engineRequested;
      engineBedTimer = 0;
    }

    // Leito contínuo em pequenos trechos sobrepostos: grave, sem apito agudo.
    if (engineRequested && audioCore.isUnlocked) {
      engineBedTimer -= delta;
      if (engineBedTimer <= 0) {
        play('engineBed', {
          frequency: boosting ? 68 : 58,
          endFrequency: boosting ? 82 : 70,
          volume: boosting ? 0.032 : 0.024
        });
        engineBedTimer = 1.35;
      }
    } else {
      engineBedTimer = 0;
    }

    // Zumbido elétrico discreto enquanto as luzes das naceles estão acesas.
    if (nacellesLit && audioCore.isUnlocked) {
      nacelleHumTimer -= delta;
      if (nacelleHumTimer <= 0) {
        play('nacelleHum', { volume: 0.010 });
        nacelleHumTimer = 1.25;
      }
    } else {
      nacelleHumTimer = 0;
    }

    if (Boolean(boosting) !== boostActive) {
      if (boosting) play('boost');
      boostActive = Boolean(boosting);
    }
    if (Boolean(braking) !== brakeActive) {
      if (braking) play('brake');
      brakeActive = Boolean(braking);
    }

    maneuverCooldown = Math.max(0, maneuverCooldown - delta);
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
    engineBedTimer = 0;
    nacelleHumTimer = 0;
  }

  function dispose() {
    resetFlight();
    disposed = true;
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
