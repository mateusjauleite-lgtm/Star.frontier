/**
 * Adaptador de áudio do personagem.
 *
 * Conecta eventos do characterCore ao núcleo global de áudio sem acoplar
 * o personagem à implementação da Web Audio API.
 *
 * Os IDs de som são opcionais. Sem arquivos registrados, as ações continuam
 * funcionando silenciosamente até que os assets reais sejam adicionados.
 */
import { on } from '../core/events.js';
import { audioCore } from '../systems/audio.js';

const DEFAULT_SOUND_IDS = Object.freeze({
  jump: 'character.jump',
  land: 'character.land',
  equip: 'character.equip',
  interact: 'character.interact',
  enterSeat: 'character.enter-seat',
  leaveSeat: 'character.leave-seat',
  weaponFire: 'character.weapon-fire',
  footstep: 'character.footstep'
});

export function createCharacterAudio(options = {}) {
  const audio = options.audio || audioCore;
  const soundIds = { ...DEFAULT_SOUND_IDS, ...(options.soundIds || {}) };
  const subscriptions = [];
  let attached = false;
  let previousGrounded = true;
  let previousMode = 'on-foot';
  let disposed = false;

  function playAction(action, playbackOptions = {}) {
    if (disposed) return Promise.resolve(null);
    const id = soundIds[action];
    if (!id) return Promise.resolve(null);
    return audio.play(id, {
      bus: 'sfx',
      ...playbackOptions
    });
  }

  function registerSounds(definitions = {}) {
    for (const [action, definition] of Object.entries(definitions)) {
      if (!soundIds[action] || !definition?.url) continue;
      audio.registerSound(soundIds[action], definition.url, {
        bus: 'sfx',
        volume: 1,
        ...definition
      });
    }
  }

  function attach() {
    if (disposed) throw new Error('Adaptador de áudio do personagem encerrado.');
    if (attached) return detach;
    attached = true;

    subscriptions.push(on('character:grounded-changed', snapshot => {
      const grounded = Boolean(snapshot?.grounded);
      if (previousGrounded && !grounded) playAction('jump');
      if (!previousGrounded && grounded) playAction('land');
      previousGrounded = grounded;
    }));

    subscriptions.push(on('character:mode-changed', snapshot => {
      const mode = snapshot?.mode || 'on-foot';
      if (mode !== previousMode) {
        playAction(mode === 'ship-control' ? 'enterSeat' : 'leaveSeat');
      }
      previousMode = mode;
    }));

    subscriptions.push(on('character:equipment-changed', () => {
      playAction('equip');
    }));

    subscriptions.push(on('character:interaction-target-changed', snapshot => {
      if (snapshot?.interactionTarget) playAction('interact');
    }));

    return detach;
  }

  function detach() {
    while (subscriptions.length) {
      const unsubscribe = subscriptions.pop();
      try { unsubscribe(); } catch {}
    }
    attached = false;
  }

  function dispose() {
    if (disposed) return;
    detach();
    disposed = true;
  }

  return Object.freeze({
    attach,
    detach,
    dispose,
    playAction,
    registerSounds,
    get attached() { return attached; },
    get soundIds() { return { ...soundIds }; }
  });
}
