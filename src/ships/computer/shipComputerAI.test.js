import test from 'node:test';
import assert from 'node:assert/strict';
import { createShipComputer } from './shipComputer.js';

test('AURORA mantém banco de dados próprio vinculado ao identificador da nave', () => {
  let stored = null;
  const adapter = { load: () => stored, save: value => { stored = value; } };
  const computer = createShipComputer({ shipId: 'test-ship', aiDatabaseAdapter: adapter });
  computer.registerSystem('power', { name: 'Energia', commands: { status: () => ({ reserve: 10 }) }, getStatus: () => 'online' });
  computer.boot();

  const learned = computer.onboardAI.learn({ topic: 'EPS', content: 'Barramento de energia principal.' });
  assert.equal(learned.accepted, true);
  assert.equal(computer.onboardAI.searchKnowledge('barramento').length, 1);
  assert.equal(stored.shipId, 'test-ship');
  assert.equal(computer.getSnapshot().onboardAI.name, 'AURORA');
  assert.equal(computer.getSnapshot().onboardAI.database.knowledgeEntries, 4);
});

test('AURORA faz ronda de sistemas consultando o estado registrado sem alterar a simulação', () => {
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
  assert.deepEqual(repaired.result, { accepted: true, authority: 'onboard-ai', operator: 'AURORA-IA' });
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

  const patrol = computer.onboardAI.processUtterance('AURORA, faça uma ronda dos sistemas');
  assert.equal(patrol.ok, true);
  assert.equal(patrol.report.systemsChecked, 1);
  const diagnostic = computer.onboardAI.processUtterance('execute um diagnóstico geral');
  assert.equal(diagnostic.ok, true);
  assert.equal(diagnostic.report.systemsChecked, 1);
  const unknown = computer.onboardAI.processUtterance('mude a arquitetura da nave');
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reason, 'voice-intent-not-mapped');
});

test('reconhecimento de voz informa indisponibilidade sem quebrar o computador', () => {
  const computer = createShipComputer();
  computer.boot();
  const result = computer.onboardAI.startVoiceRecognition();
  assert.equal(typeof result.started, 'boolean');
  if (!result.started) assert.equal(result.reason, 'speech-recognition-unavailable');
  computer.onboardAI.stopVoiceRecognition();
});
