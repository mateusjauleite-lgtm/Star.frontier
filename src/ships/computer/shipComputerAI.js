// Núcleo único da Alexia, supervisionado pelo Ship Computer.
// Conversa, voz, conhecimento e telemetria usam o mesmo processador.
const DATABASE_VERSION = 2;
const REPAIR_COMMAND_PREFIXES = ['repair', 'restore', 'reconcile'];
const HISTORY_LIMIT = 300;
const KNOWLEDGE_LIMIT = 500;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{L}\p{N}\s_-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  return [...new Set(normalizeText(value).split(' ').filter(token => token.length > 2))];
}

export function createShipComputerAI({
  shipId,
  getSnapshot,
  getSystemIds,
  inspectSystem,
  getTelemetry = inspectSystem,
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
    identity: { name: String(initialName || 'Alexia').trim().slice(0, 32) || 'Alexia' },
    knowledge: [],
    observations: [],
    diagnostics: [],
    actions: [],
    messages: []
  };
  const listeners = new Set();
  let aiName = database.identity.name;
  let voiceRecognition = null;
  let crewController = null;
  let voiceState = (globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition) ? 'ready' : 'unsupported';

  function persist() {
    database.updatedAt = new Date().toISOString();
    database.identity = { name: aiName };
    databaseAdapter?.save?.(clone(database));
    onChange(snapshot());
    for (const listener of listeners) listener(snapshot());
  }

  function loadDatabase() {
    const saved = databaseAdapter?.load?.();
    if (!saved || Number(saved.version) > DATABASE_VERSION || saved.shipId !== database.shipId) return false;
    for (const key of ['knowledge', 'observations', 'diagnostics', 'actions', 'messages']) {
      if (Array.isArray(saved[key])) database[key] = clone(saved[key]);
    }
    database.createdAt = saved.createdAt || database.createdAt;
    database.updatedAt = saved.updatedAt || database.updatedAt;
    aiName = String(saved.identity?.name || initialName || 'Alexia').trim().slice(0, 32) || 'Alexia';
    database.version = DATABASE_VERSION;
    return true;
  }

  function append(collection, entry, limit = 500) {
    database[collection].push({
      id: `${collection}-${Date.now()}-${database[collection].length + 1}`,
      at: new Date().toISOString(),
      ...clone(entry)
    });
    if (database[collection].length > limit) database[collection].splice(0, database[collection].length - limit);
    persist();
  }

  function appendConversation(userText, assistantText, source, intent) {
    const at = new Date().toISOString();
    const sequence = database.messages.length;
    database.messages.push(
      { id: `message-${Date.now()}-${sequence + 1}`, role: 'user', content: String(userText).slice(0, 2000), source, at },
      { id: `message-${Date.now()}-${sequence + 2}`, role: 'assistant', content: String(assistantText).slice(0, 4000), source: 'alexia', intent, at: new Date().toISOString() }
    );
    if (database.messages.length > HISTORY_LIMIT) {
      database.messages.splice(0, database.messages.length - HISTORY_LIMIT);
    }
    persist();
  }

  function snapshot() {
    return {
      id: 'alexia-onboard-ai',
      name: aiName,
      status: isOnline() ? 'online' : 'offline',
      shipId: database.shipId,
      database: {
        version: database.version,
        knowledgeEntries: database.knowledge.length,
        observations: database.observations.length,
        diagnostics: database.diagnostics.length,
        actions: database.actions.length,
        messages: database.messages.length,
        updatedAt: database.updatedAt
      },
      voice: { state: voiceState, supported: voiceState !== 'unsupported' },
      knownSystems: getSystemIds(),
      crew: crewController ? crewController.getSnapshot() : { status: 'unbound' }
    };
  }

  function bindCrewController(controller) {
    if (controller === null) {
      crewController = null;
      return { accepted: true, connected: false };
    }
    if (!controller || typeof controller.getSnapshot !== 'function' ||
        typeof controller.move !== 'function' || typeof controller.stop !== 'function') {
      return { accepted: false, reason: 'invalid-crew-controller' };
    }
    crewController = controller;
    return { accepted: true, connected: true, crew: crewController.getSnapshot() };
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
    const item = {
      topic: String(entry.topic).slice(0, 80),
      content: String(entry.content).slice(0, 2000),
      source: String(entry.source || 'ship-computer').slice(0, 120)
    };
    database.knowledge.push(item);
    if (database.knowledge.length > KNOWLEDGE_LIMIT) database.knowledge.shift();
    persist();
    return { accepted: true, entry: clone(item) };
  }

  function searchKnowledge(query) {
    const terms = tokenize(query);
    if (!terms.length) return [];
    return database.knowledge
      .map(item => {
        const haystack = normalizeText(`${item.topic} ${item.content}`);
        const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
        return { item, score };
      })
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(result => clone(result.item));
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
    const registered = getSystemIds();
    const ids = systemId ? [systemId] : registered;
    const results = ids.filter(id => registered.includes(id)).map(id => {
      try { return { systemId: id, ...clone(inspectSystem(id)) }; }
      catch (error) { return { systemId: id, status: 'error', error: String(error?.message || error) }; }
    });
    const report = {
      systemsChecked: results.length,
      results,
      findings: results.filter(item => ['error', 'offline', 'fault', 'corrupt', 'degraded'].includes(String(item.status || '').toLowerCase()))
    };
    append('diagnostics', report);
    return { ok: true, report };
  }

  function executeAuthorized({ terminalId, systemId, command, payload = {} } = {}) {
    if (!isOnline()) return { ok: false, reason: 'ship-computer-offline' };
    if (!terminalId || !systemId || !command) return { ok: false, reason: 'invalid-command' };
    const isRepair = REPAIR_COMMAND_PREFIXES.some(prefix => command.toLowerCase().startsWith(prefix));
    const response = dispatchAuthorized({
      terminalId, systemId, command, payload,
      authority: 'onboard-ai',
      operation: isRepair ? 'repair' : 'operation'
    });
    append('actions', {
      terminalId, systemId, command,
      operation: isRepair ? 'repair' : 'operation',
      accepted: Boolean(response?.ok && response?.result?.accepted !== false),
      result: response?.result ?? null,
      reason: response?.reason ?? null
    });
    return response;
  }

  function formatSystemsTelemetry() {
    const ids = getSystemIds();
    if (!ids.length) return 'O Ship Computer não informou sistemas registrados neste momento.';
    const rows = ids.map(id => {
      let report;
      try { report = getTelemetry(id) || {}; }
      catch (error) { report = { status: 'error', error: String(error?.message || error) }; }
      const label = report.name || id;
      const status = String(report.status || inspectSystem(id)?.status || 'registrado').toLocaleUpperCase('pt-BR');
      const details = report.telemetry && typeof report.telemetry === 'object'
        ? JSON.stringify(report.telemetry).slice(0, 360)
        : '';
      return details ? `• ${label}: ${status} — ${details}` : `• ${label}: ${status}`;
    });
    return `Telemetria de bordo — ${ids.length} sistemas registrados:\n${rows.join('\n')}`;
  }

  function buildResponse(message, { requireWakeWord = false } = {}) {
    let command = normalizeText(message);
    const wakeName = normalizeText(aiName);
    const hasWakeName = wakeName && command.startsWith(wakeName);
    if (requireWakeWord && !hasWakeName) {
      return { ok: false, reason: 'wake-name-not-detected', intent: 'ignored', response: `Para comandos por voz, chame ${aiName} antes da solicitação.` };
    }
    if (hasWakeName) command = command.slice(wakeName.length).trim();

    if (!command) {
      return { ok: true, intent: 'greeting', response: `À disposição. Sou ${aiName}, integrada ao Ship Computer. Pode escrever uma consulta ou solicitar uma verificação.` };
    }
    if (/\b(ajuda|o que voce faz|comandos|capacidades)\b/.test(command)) {
      return {
        ok: true,
        intent: 'help',
        response: 'Posso consultar o estado dos sistemas, executar rondas de supervisão, gerar diagnósticos e pesquisar meu banco de conhecimento. Comandos que alteram sistemas dependem de autorização explícita do Ship Computer.'
      };
    }
    if (/\b(ronda|verifique|verificar|supervisao|supervisionar)\b/.test(command)) {
      const result = runPatrol();
      if (!result.ok) return { ...result, intent: 'patrol', response: 'Não consegui iniciar a ronda: o Ship Computer está offline.' };
      const faults = result.report.findings.length;
      return {
        ...result,
        intent: 'patrol',
        response: faults
          ? `Ronda concluída. Verifiquei ${result.report.systemsChecked} sistemas e encontrei ${faults} condição(ões) que merecem atenção.`
          : `Ronda concluída. ${result.report.systemsChecked} sistemas verificados; nenhum estado crítico foi identificado.`
      };
    }
    if (/\b(diagnostico|diagnosticar|falhas|anomalias)\b/.test(command)) {
      const result = diagnose();
      if (!result.ok) return { ...result, intent: 'diagnostics', response: 'Não consegui executar o diagnóstico: o Ship Computer está offline.' };
      const faults = result.report.findings.length;
      return {
        ...result,
        intent: 'diagnostics',
        response: faults
          ? `Diagnóstico concluído. ${faults} sistema(s) apresentam estados que exigem análise. Consulte o relatório para os detalhes.`
          : `Diagnóstico concluído. ${result.report.systemsChecked} sistemas analisados, sem falhas registradas.`
      };
    }
    if (/\b(status|situacao|telemetria|sistemas|estado da nave|como esta a nave)\b/.test(command)) {
      return { ok: true, intent: 'telemetry', response: formatSystemsTelemetry(), telemetry: clone(getSnapshot()) };
    }
    if (/\b(pare|parar|interrompa|fique parada|fique imovel)\b/.test(command)) {
      if (!crewController) return { ok: false, intent: 'crew-unavailable', response: 'Meu corpo físico ainda não está conectado ao Runtime.' };
      const result = crewController.stop();
      return { ok: true, intent: 'crew-stop', result, response: 'Movimento interrompido. Estou parada.' };
    }

    const movementRequest = command.match(/\b(?:ande|caminhe|avance|mova-se|va|siga)\s+(?:para\s+)?(frente|tras|esquerda|direita)\b/);
    if (movementRequest) {
      if (!crewController) return { ok: false, intent: 'crew-unavailable', response: 'Meu corpo físico ainda não está conectado ao Runtime.' };
      const direction = ({ frente: 'forward', tras: 'backward', esquerda: 'left', direita: 'right' })[movementRequest[1]];
      const result = crewController.move({ direction, durationSeconds: 2 });
      return result.accepted
        ? { ok: true, intent: 'crew-move', result, response: `Iniciando deslocamento curto para ${movementRequest[1]}.` }
        : { ok: false, intent: 'crew-move-rejected', result, response: 'Não consegui iniciar esse deslocamento.' };
    }

    if (/\b(execute|ative|desative|ligue|desligue|repare|ajuste|modifique|transfira|inicie)\b/.test(command))
      return {
        ok: false,
        reason: 'explicit-authorization-required',
        intent: 'operation-blocked',
        response: 'Entendi que você deseja alterar um sistema, mas esta solicitação ainda não está vinculada a um comando operacional autorizado. Não alterei nenhum estado da nave.'
      };
    }

    const matches = searchKnowledge(command);
    if (matches.length) {
      return {
        ok: true,
        intent: 'knowledge',
        response: matches.map(item => `• ${item.topic}: ${item.content}`).join('\n'),
        knowledge: matches
      };
    }
    return {
      ok: true,
      intent: 'unknown',
      response: 'Ainda não encontrei uma resposta segura para essa solicitação. Posso consultar a telemetria, fazer uma ronda, executar diagnósticos ou pesquisar meu banco de conhecimento.'
    };
  }

  function processMessage(message, { source = 'text', requireWakeWord = false } = {}) {
    const input = String(message ?? '').trim().slice(0, 2000);
    if (!input) return { ok: false, reason: 'empty-message', response: 'A mensagem está vazia.' };
    if (!isOnline()) return { ok: false, reason: 'ship-computer-offline', response: 'O Ship Computer está offline. A conversa não pode ser processada agora.' };
    const result = buildResponse(input, { requireWakeWord });
    if (result.reason === 'wake-name-not-detected') return result;
    appendConversation(input, result.response, source, result.intent);
    return { ...result, source, history: getConversationHistory() };
  }

  function processUtterance(utterance) {
    return processMessage(utterance, { source: 'voice', requireWakeWord: true });
  }

  function getConversationHistory(limit = 80) {
    const safeLimit = Math.max(1, Math.min(HISTORY_LIMIT, Number(limit) || 80));
    return clone(database.messages.slice(-safeLimit));
  }

  function startVoiceRecognition({ onResult = () => {}, onError = () => {} } = {}) {
    const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    if (!Recognition) {
      voiceState = 'unsupported';
      persist();
      return { ok: false, started: false, reason: 'speech-recognition-unavailable' };
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
      return { ok: true, started: true, language: 'pt-BR' };
    } catch (error) {
      voiceState = 'error';
      persist();
      return { ok: false, started: false, reason: String(error?.message || error) };
    }
  }

  function stopVoiceRecognition() {
    const wasListening = Boolean(voiceRecognition);
    voiceRecognition?.stop?.();
    voiceRecognition = null;
    voiceState = (globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition) ? 'ready' : 'unsupported';
    persist();
    return { ok: true, stopped: wasListening };
  }

  loadDatabase();
  if (database.knowledge.length === 0) {
    database.knowledge.push(
      { topic: 'autoridade', content: 'O Ship Computer controla as permissões. A Alexia não pode conceder acesso a si mesma.' },
      { topic: 'runtime', content: 'O Runtime é a fonte oficial do estado da simulação e executa os sistemas.' },
      { topic: 'seguranca', content: 'A Alexia consulta sistemas existentes e só executa comandos registrados e autorizados. Ela não cria sistemas nem recursos.' },
      { topic: 'energia', content: 'Os barramentos EPS pertencem ao núcleo energético. A matriz condiciona plasma para o núcleo; não alimenta diretamente os barramentos.' }
    );
  }

  return Object.freeze({
    snapshot,
    bindCrewController,
    setName,
    getDatabase: () => clone(database),
    learn,
    searchKnowledge,
    runPatrol,
    diagnose,
    executeAuthorized,
    processMessage,
    processUtterance,
    getConversationHistory,
    startVoiceRecognition,
    stopVoiceRecognition,
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Listener inválido.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  });
}
