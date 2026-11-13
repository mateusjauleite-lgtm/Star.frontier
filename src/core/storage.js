// Persistência local do perfil e do progresso do jogador.
import { state, resetTransientState } from './state.js';

const STORAGE_KEY = 'sf-demo-state';

export function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn('Não foi possível salvar:', error);
    return false;
  }
}

export function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;

    const data = JSON.parse(stored);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return false;
    }

    Object.assign(state, data);
    // A nave ativa atual substitui o identificador antigo salvo localmente.
    state.ship = 'Nave exploradora';

    state.settings = {
      quality: 'Média',
      music: 40,
      effects: 70,
      sensitivity: 1,
      ...(data.settings && typeof data.settings === 'object'
        ? data.settings
        : {})
    };

    resetTransientState();
    state.nitro = Number.isFinite(data.nitro) ? data.nitro : 100;

    return true;
  } catch (error) {
    console.warn('Erro ao carregar dados:', error);
    return false;
  }
}

export { STORAGE_KEY };
