import test from 'node:test';
import assert from 'node:assert/strict';
import { createShipComputer } from './shipComputer.js';

test('Alexia mantém banco de dados próprio vinculado ao identificador da nave', () => {
  let stored = null;
  const adapter = { load: () => stored, save: value => { stored = value; } };
  const computer = createShipComputer({ shipId: 'test-ship', aiDatabaseAdapter: adapter });
  computer.registerSystem('power', { name: 'Energia', commands: { status: () => ({ reserve: 10 }) }, getStatus: () => 'online' });
  computer.boot();

  const learned = computer.onboardAI.learn({ topic: 'EPS', content: 'Barramento de energia principal.' });
  assert.equal(learned.accepted, true);
  assert.equal(computer.onboardAI.searchKnowledge('barramento').length, 2);
  assert.equal(stored.shipId, 'test-ship');
  assert.equal(computer.getSnapshot().onboardAI.name, 'Alexia');
  assert.equal(computer.getSnapshot().onboardAI.database.knowledgeEntries, 5);
});

test('Alexia faz ronda de sistemas consultando o estado registrado sem alterar a simulação', () => {
  const state = { reserve: 14 };
  const computer = createShipComputer();
  computer.registerSystem('power', {
    name: 'Energia',
    commands: { status: () => ({ reserve: state.reserve }) },
    getStatus: () => state.reserve > 0 ? 'online' : 'offline'
  });
  computer.registerSystem('sensors', { name: 'Sensores', commands: {}, getStatus: () => 'fault' });
  computer.boot();

  const result = computer.onboardAI.runPatrol();
  assert.equal(result.ok, true);
  assert.equal(result.report.systemsChecked, 2);
  assert.deepEqual(result.report.findings.map(item => item.id), ['sensors']);
  assert.equal(state.reserve, 14);
  assert.equal(computer.onboardAI.getDatabase().observations.length, 1);
});

test('somente o Ship Computer concede permissão para a IA executar comandos já registrados', () => {
  const computer = createShipComputer();
  let executed = 0;
  computer.registerSystem('power', {
    name: 'Energia',
    commands: {
      status: () => ({ available: true }),
      repairBus: (payload, context) => {
        executed += 1;
        return { accepted: true, authority: context.authority, operator: context.operator };
      }
    }
  });
  computer.registerTerminal({ id: 'engineering-console', systems: ['power'] });
  computer.boot();

  const denied = computer.onboardAI.executeAuthorized({
    terminalId: 'engineering-console', systemId: 'power', command: 'repairBus'
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, 'ai-permission-denied');
  assert.equal(executed, 0);

  const grant = computer.grantAIPermission({
    terminalId: 'engineering-console', systemId: 'power', commands: ['repairBus', 'notRegistered']
  });
  assert.deepEqual(grant, { granted: true, terminalId: 'engineering-console', systemId: 'power', commands: ['repairBus'] });
  const repaired = computer.onboardAI.executeAuthorized({
    terminalId: 'engineering-console', systemId: 'power', command: 'repairBus'
  });
  assert.equal(repaired.ok, true);
  assert.deepEqual(repaired.result, { accepted: true, authority: 'onboard-ai', operator: 'ALEXIA' });
  assert.equal(executed, 1);
  assert.equal(computer.onboardAI.executeAuthorized({
    terminalId: 'engineering-console', systemId: 'power', command: 'createNewSystem'
  }).reason, 'ai-permission-denied');
});

test('permissões da IA são revogáveis pelo Ship Computer e não sobrevivem ao desligamento', () => {
  const computer = createShipComputer();
  computer.registerSystem('navigation', { commands: { repairNavigation: () => ({ accepted: true }) } });
  computer.registerTerminal({ id: 'bridge', systems: ['navigation'] });
  computer.boot();
  computer.grantAIPermission({ terminalId: 'bridge', systemId: 'navigation', commands: ['repairNavigation'] });
  assert.equal(computer.onboardAI.executeAuthorized({ terminalId: 'bridge', systemId: 'navigation', command: 'repairNavigation' }).ok, true);
  assert.equal(computer.revokeAIPermission({ terminalId: 'bridge', systemId: 'navigation' }), true);
  assert.equal(computer.onboardAI.executeAuthorized({ terminalId: 'bridge', systemId: 'navigation', command: 'repairNavigation' }).reason, 'ai-permission-denied');
  computer.grantAIPermission({ terminalId: 'bridge', systemId: 'navigation', commands: ['repairNavigation'] });
  computer.shutdown();
  assert.deepEqual(computer.listAIPermissions(), []);
});

test('comandos de voz em português acionam somente diagnóstico e ronda cadastrados', () => {
  const computer = createShipComputer();
  computer.registerSystem('navigation', { commands: {}, getStatus: () => 'online' });
  computer.boot();

  const patrol = computer.onboardAI.processUtterance('Alexia, faça uma ronda dos sistemas');
  assert.equal(patrol.ok, true);
  assert.equal(patrol.report.systemsChecked, 1);
  const diagnostic = computer.onboardAI.processUtterance('Alexia, execute um diagnóstico geral');
  assert.equal(diagnostic.ok, true);
  assert.equal(diagnostic.report.systemsChecked, 1);
  const unknown = computer.onboardAI.processUtterance('Alexia, mude a arquitetura da nave');
  assert.equal(unknown.ok, true);
  assert.equal(unknown.intent, 'unknown');
  assert.match(unknown.response, /ainda não encontrei uma resposta segura/i);
  assert.equal(computer.onboardAI.processUtterance('faça uma ronda').reason, 'wake-name-not-detected');
  assert.equal(computer.onboardAI.setName('ALEXIA').accepted, true);
});

test('reconhecimento de voz informa indisponibilidade sem quebrar o computador', () => {
  const computer = createShipComputer();
  computer.boot();
  const result = computer.onboardAI.startVoiceRecognition();
  assert.equal(typeof result.started, 'boolean');
  if (!result.started) assert.equal(result.reason, 'speech-recognition-unavailable');
  computer.onboardAI.stopVoiceRecognition();
});

test('chat da Alexia consulta telemetria e persiste mensagens no mesmo banco da nave', () => {
  let stored = null;
  const computer = createShipComputer({
    shipId: 'chat-ship',
    aiDatabaseAdapter: { load: () => stored, save: value => { stored = value; } }
  });
  computer.registerSystem('power', {
    name: 'Energia principal',
    commands: { status: () => ({ reserve: 42 }) },
    getStatus: () => 'online'
  });
  computer.registerSystem('sensors', {
    name: 'Sensores',
    commands: {},
    getStatus: () => 'standby'
  });
  computer.boot();

  const answer = computer.onboardAI.processMessage('Qual a situação da nave?');
  assert.equal(answer.ok, true);
  assert.equal(answer.intent, 'telemetry');
  assert.match(answer.response, /Energia principal: ONLINE/);
  assert.match(answer.response, /Sensores: STANDBY/);
  assert.equal(stored.messages.length, 2);
  assert.equal(stored.version, 2);

  const restored = createShipComputer({
    shipId: 'chat-ship',
    aiDatabaseAdapter: { load: () => stored, save: value => { stored = value; } }
  });
  restored.boot();
  assert.equal(restored.onboardAI.getConversationHistory().length, 2);
  assert.equal(restored.onboardAI.getConversationHistory()[1].content, answer.response);
});

test('mensagens escritas e comandos de voz usam o mesmo processador de conversa', () => {
  const computer = createShipComputer();
  computer.registerSystem('navigation', { commands: {}, getStatus: () => 'online' });
  computer.boot();

  const typed = computer.onboardAI.processMessage('Alexia, faça uma ronda dos sistemas');
  const voice = computer.onboardAI.processUtterance('Alexia, faça uma ronda dos sistemas');
  assert.equal(typed.intent, 'patrol');
  assert.equal(voice.intent, typed.intent);
  assert.equal(voice.source, 'voice');
  assert.equal(computer.onboardAI.getConversationHistory().length, 4);
  assert.equal(computer.onboardAI.processUtterance('faça uma ronda').reason, 'wake-name-not-detected');
});

test('a Alexia não executa alterações de sistemas sem autorização operacional', () => {
  const computer = createShipComputer();
  computer.registerSystem('shields', {
    commands: { setEnabled: () => ({ accepted: true }) },
    getStatus: () => 'online'
  });
  computer.boot();
  const response = computer.onboardAI.processMessage('Desative os escudos');
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'explicit-authorization-required');
  assert.equal(response.intent, 'operation-blocked');
});


test('chat da Alexia encaminha comandos curtos ao corpo físico sem criar outro núcleo de IA', () => {
  const computer = createShipComputer();
  computer.boot();
  const calls = [];
  const controller = {
    getSnapshot: () => ({ id: 'character:alexia', status: 'online' }),
    move: request => { calls.push(['move', request]); return { accepted: true, direction: request.direction }; },
    stop: () => { calls.push(['stop']); return { accepted: true, moving: false }; }
  };

  assert.equal(computer.onboardAI.bindCrewController(controller).connected, true);
  const movement = computer.onboardAI.processMessage('Alexia, caminhe para frente');
  assert.equal(movement.intent, 'crew-move');
  assert.equal(movement.result.direction, 'forward');
  assert.deepEqual(calls[0], ['move', { direction: 'forward', durationSeconds: 2 }]);

  const stopped = computer.onboardAI.processMessage('Alexia, pare');
  assert.equal(stopped.intent, 'crew-stop');
  assert.deepEqual(calls[1], ['stop']);
  assert.equal(computer.onboardAI.snapshot().crew.status, 'online');
});
