// Persistência local do perfil e do progresso do jogador.
import { state, resetTransientState } from './state.js';

const STORAGE_KEY = 'sf-demo-state';
const BACKUP_KEY = 'sf-demo-state-backup';

function parseStoredObject(raw) {
  if (!raw) return null;
  const data = JSON.parse(raw);
  return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
}

export function saveState() {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return false;
    const serialized = JSON.stringify(state);
    const previous = storage.getItem(STORAGE_KEY);
    if (previous) {
      try {
        if (parseStoredObject(previous)) storage.setItem(BACKUP_KEY, previous);
      } catch {
        // Não substituir um backup íntegro por um registro principal corrompido.
      }
    }
    storage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch (error) {
    console.warn('Não foi possível salvar:', error);
    return false;
  }
}

export function loadState() {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return false;
    let data = null;
    let restoredFromBackup = false;

    try {
      data = parseStoredObject(storage.getItem(STORAGE_KEY));
    } catch {
      data = null;
    }
    if (!data) {
      try {
        data = parseStoredObject(storage.getItem(BACKUP_KEY));
        restoredFromBackup = Boolean(data);
      } catch {
        data = null;
      }
    }
    if (!data) return false;

    Object.assign(state, data);
    // Reservas antigas de Nitro/dobra eram percentuais; não são convertidas
    // em massa de dilítio. Saves antigos recebem apenas o saldo inicial configurado.
    state.refinedDilithium = Number.isFinite(data.refinedDilithium)
      ? Math.max(0, Math.min(500, data.refinedDilithium))
      : 100;
    state.rawDilithiumOre = Number.isFinite(data.rawDilithiumOre)
      ? Math.max(0, Math.min(500, data.rawDilithiumOre))
      : 0;
    state.warpCoreDilithium = Number.isFinite(data.warpCoreDilithium)
      ? Math.max(0, Math.min(500, data.warpCoreDilithium))
      : 0;
    state.dilithiumRefineryActive = Boolean(data.dilithiumRefineryActive);
    state.warpStage = Number.isFinite(data.warpStage)
      ? Math.max(1, Math.min(5, Math.round(data.warpStage)))
      : 5;
    state.warpExitMode = data.warpExitMode === 'direct' ? 'direct' : 'smooth';
    state.propulsionAuthority = 'bridge';
    delete state.warpDriveCharge;
    delete state.nitro;
    delete state.nitroButton;
    // A nave ativa atual substitui o identificador antigo salvo localmente.
    state.ship = 'Nave exploradora';
    state.settings = {
      quality: 'Média',
      music: 40,
      effects: 70,
      sensitivity: 1,
      ...(data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)
        ? data.settings
        : {})
    };

    resetTransientState();

    if (restoredFromBackup) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        console.warn('Dados recuperados, mas não foi possível restaurar o arquivo principal:', error);
      }
    }
    return true;
  } catch (error) {
    console.warn('Erro ao carregar dados:', error);
    return false;
  }
}

export { STORAGE_KEY, BACKUP_KEY };
