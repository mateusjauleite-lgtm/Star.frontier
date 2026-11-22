// Núcleo da IA de bordo AURORA. Não cria sistemas: observa e opera somente
// comandos já registrados e autorizados pelo Ship Computer.
const DATABASE_VERSION = 1;
const REPAIR_COMMAND_PREFIXES = ['repair', 'restore', 'reconcile'];

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function createShipComputerAI({
  shipId,
  getSnapshot,
  getSystemIds,
  inspectSystem,
  dispatchAuthorized,
  isOnline,
  initialName = 'Alexia',
  databaseAdapter = null,
  onChange = () => {}
} = {}) {
  if (typeof getSnapshot !== 'function' || typeof getSystemIds !== 'function' ||
      typeof inspectSystem !== 'function' || typeof dispatchAuthorized !== 'function' ||
      typeof isOnline !== 'function') {
    throw new TypeError('Dependências da IA de bordo incompletas.');
  }

  const database = {
    version: DATABASE_VERSION,
    shipId: String(shipId || 'unknown-ship'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    knowledge: [],
    observations: [],
    diagnostics: [],
    actions: []
  };
  const listeners = new Set();
  let aiName = String(initialName || 'Alexia').trim().slice(0, 32) || 'Alexia';
  let voiceRecognition = null;
  let voiceState = (globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition) ? 'ready' : 'unsupported';

  function persist() {
    database.updatedAt = new Date().toISOString();
    databaseAdapter?.save?.(clone(database));
    onChange(snapshot());
    for (const listener of listeners) listener(snapshot());
  }

  function loadDatabase() {
    const saved = databaseAdapter?.load?.();
    if (!saved || saved.version !== DATABASE_VERSION || saved.shipId !== database.shipId) return false;
    for (const key of ['knowledge', 'observations', 'diagnostics', 'actions']) {
      if (Array.isArray(saved[key])) database[key] = clone(saved[key]);
    }
    database.createdAt = saved.createdAt || database.createdAt;
    database.updatedAt = saved.updatedAt || database.updatedAt;
    return true;
  }

  function append(collection, entry, limit = 500) {
    database[collection].push({ id: `${collection}-${Date.now()}-${database[collection].length + 1}`, at: new Date().toISOString(), ...clone(entry) });
    if (database[collection].length > limit) database[collection].splice(0, database[collection].length - limit);
    persist();
  }

  function snapshot() {
    return {
      id: 'aurora-onboard-ai',
      name: aiName,
      status: isOnline() ? 'online' : 'offline',
      shipId: database.shipId,
      database: {
        version: database.version,
        knowledgeEntries: database.knowledge.length,
        observations: database.observations.length,
        diagnostics: database.diagnostics.length,
        actions: database.actions.length,
        updatedAt: database.updatedAt
      },
      voice: { state: voiceState, supported: voiceState !== 'unsupported' },
      knownSystems: getSystemIds()
    };
  }

  function setName(name) {
    const next = String(name || '').trim().slice(0, 32);
    if (!next) return { accepted: false, reason: 'invalid-name' };
    aiName = next;
    append('observations', { type: 'identity-name-change', name: aiName });
    return { accepted: true, name: aiName };
  }

  function learn(entry) {
    if (!entry || typeof entry !== 'object' || !entry.topic || !entry.content) {
      return { accepted: false, reason: 'invalid-knowledge-entry' };
    }
    const item = { topic: String(entry.topic).slice(0, 80), content: String(entry.content).slice(0, 2000), source: String(entry.source || 'ship-computer').slice(0, 120) };
    database.knowledge.push(item);
    persist();
    return { accepted: true, entry: clone(item) };
  }

  function searchKnowledge(query) {
    const term = String(query || '').trim().toLocaleLowerCase('pt-BR');
    if (!term) return [];
    return database.knowledge.filter(item => `${item.topic} ${item.content}`.toLocaleLowerCase('pt-BR').includes(term)).map(clone);
  }

  function runPatrol() {
    if (!isOnline()) return { ok: false, reason: 'ship-computer-offline' };
    const systems = getSystemIds().map(id => {
      let inspection;
      try { inspection = inspectSystem(id); }
      catch (error) { inspection = { status: 'error', error: String(error?.message || error) }; }
      return { id, ...clone(inspection || { status: 'unknown' }) };
    });
    const findings = systems.filter(system => !['online', 'monitoring', 'ready', 'standby'].includes(String(system.status || '').toLowerCase()));
    const report = { systemsChecked: systems.length, findings, systems };
    append('observations', { type: 'system-patrol', report });
    return { ok: true, report };
  }

  function diagnose(systemId = null) {
    if (!isOnline()) return { ok: false, reason: 'ship-computer-offline' };
    const ids = systemId ? [systemId] : getSystemIds();
    const results = ids.filter(id => getSystemIds().includes(id)).map(id => {
      try { return { systemId: id, ...clone(inspectSystem(id)) }; }
      catch (error) { return { systemId: id, status: 'error', error: String(error?.message || error) }; }
    });
    const report = { systemsChecked: results.length, results, findings: results.filter(item => ['error', 'offline', 'fault', 'corrupt', 'degraded'].includes(String(item.status || '').toLowerCase())) };
    append('diagnostics', report);
    return { ok: true, report };
  }

  function executeAuthorized({ terminalId, systemId, command, payload = {} } = {}) {
    if (!isOnline()) return { ok: false, reason: 'ship-computer-offline' };
    if (!terminalId || !systemId || !command) return { ok: false, reason: 'invalid-command' };
    const isRepair = REPAIR_COMMAND_PREFIXES.some(prefix => command.toLowerCase().startsWith(prefix));
    const response = dispatchAuthorized({ terminalId, systemId, command, payload, authority: 'onboard-ai', operation: isRepair ? 'repair' : 'operation' });
    append('actions', { terminalId, systemId, command, operation: isRepair ? 'repair' : 'operation', accepted: Boolean(response?.ok && response?.result?.accepted !== false), result: response?.result ?? null, reason: response?.reason ?? null });
    return response;
  }

  function processUtterance(utterance) {
    const text = String(utterance || '').trim().toLocaleLowerCase('pt-BR');
    if (!text) return { ok: false, reason: 'empty-utterance' };
    append('observations', { type: 'voice-command', utterance: text });
    if (/\b(ronda|verifique|verificar)\b/.test(text)) return runPatrol();
    if (/\b(diagn[oó]stico|diagnosticar|falhas)\b/.test(text)) return diagnose();
    if (/\b(status|situa[cç][aã]o)\b/.test(text)) return { ok: true, snapshot: getSnapshot(), ai: snapshot() };
    return { ok: false, reason: 'voice-intent-not-mapped', message: 'Comando reconhecido, mas ainda sem ação cadastrada. Nenhum sistema foi alterado.' };
  }

  function startVoiceRecognition({ onResult = () => {}, onError = () => {} } = {}) {
    const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    if (!Recognition) {
      voiceState = 'unsupported';
      return { started: false, reason: 'speech-recognition-unavailable' };
    }
    if (voiceRecognition) voiceRecognition.abort?.();
    voiceRecognition = new Recognition();
    voiceRecognition.lang = 'pt-BR';
    voiceRecognition.continuous = false;
    voiceRecognition.interimResults = false;
    voiceRecognition.onresult = event => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      const result = processUtterance(transcript);
      onResult({ transcript, result });
    };
    voiceRecognition.onerror = event => {
      voiceState = 'error';
      onError(event.error || 'speech-recognition-error');
      persist();
    };
    voiceRecognition.onend = () => {
      if (voiceState === 'listening') voiceState = 'ready';
      persist();
    };
    try {
      voiceRecognition.start();
      voiceState = 'listening';
      persist();
      return { started: true, language: 'pt-BR' };
    } catch (error) {
      voiceState = 'error';
      return { started: false, reason: String(error?.message || error) };
    }
  }

  function stopVoiceRecognition() {
    voiceRecognition?.stop?.();
    voiceRecognition = null;
    voiceState = 'ready';
    persist();
    return true;
  }

  loadDatabase();
  if (database.knowledge.length === 0) {
    database.knowledge.push(
      { topic: 'authority', content: 'The Ship Computer owns permissions. The AI cannot grant itself access.' },
      { topic: 'runtime', content: 'Runtime is the authoritative source of simulation state and executes system operations.' },
      { topic: 'safety', content: 'The AI may inspect existing systems and execute only explicitly authorized registered commands. It cannot create systems or resources.' }
    );
  }

  return Object.freeze({
    snapshot,
    getDatabase: () => clone(database),
    learn,
    searchKnowledge,
    runPatrol,
    diagnose,
    executeAuthorized,
    processUtterance,
    startVoiceRecognition,
    stopVoiceRecognition,
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Listener inválido.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  });
}
