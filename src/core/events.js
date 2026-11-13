// Barramento simples de eventos para comunicação entre módulos.
// Exemplo: on('credits:changed', atualizarHUD) e emit('credits:changed', state.credits).

const listeners = new Map();

export function on(eventName, callback) {
  if (typeof eventName !== 'string' || !eventName.trim()) {
    throw new TypeError('O nome do evento deve ser um texto válido.');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('O callback do evento deve ser uma função.');
  }

  if (!listeners.has(eventName)) {
    listeners.set(eventName, new Set());
  }

  listeners.get(eventName).add(callback);

  // Retorna uma função para cancelar a inscrição.
  return () => off(eventName, callback);
}

export function once(eventName, callback) {
  const unsubscribe = on(eventName, (...args) => {
    unsubscribe();
    callback(...args);
  });

  return unsubscribe;
}

export function off(eventName, callback) {
  const eventListeners = listeners.get(eventName);
  if (!eventListeners) return false;

  const removed = eventListeners.delete(callback);
  if (eventListeners.size === 0) listeners.delete(eventName);

  return removed;
}

export function emit(eventName, ...args) {
  const eventListeners = listeners.get(eventName);
  if (!eventListeners) return 0;

  // A cópia permite que listeners se inscrevam/cancelem durante a emissão.
  const currentListeners = [...eventListeners];

  for (const callback of currentListeners) {
    try {
      callback(...args);
    } catch (error) {
      console.error(`Erro ao processar o evento "${eventName}":`, error);
    }
  }

  return currentListeners.length;
}

export function clear(eventName) {
  if (typeof eventName === 'string') {
    listeners.delete(eventName);
    return;
  }

  listeners.clear();
}
