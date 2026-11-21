import test from 'node:test';
import assert from 'node:assert/strict';
import { createPilotHudProfileStore, PILOT_HUD_PROFILES } from './hudProfiles.js';

test('quatro perfis são criados com identificadores estáveis', () => {
  assert.deepEqual(PILOT_HUD_PROFILES.map(profile => profile.id), [
    'flight', 'navigation', 'combat', 'warp'
  ]);
});

test('layout legado do piloto migra somente para Voo', () => {
  const settings = { pilotHudLayout: { instruments: { x: 0.2, y: 0.3 } } };
  const profiles = createPilotHudProfileStore(settings);
  assert.deepEqual(profiles.getLayout('flight'), settings.pilotHudLayout);
  assert.deepEqual(profiles.getLayout('navigation'), {});
  assert.deepEqual(profiles.getLayout('combat'), {});
  assert.deepEqual(profiles.getLayout('warp'), {});
});

test('salvar ou redefinir um perfil não altera os demais', () => {
  const settings = {};
  const profiles = createPilotHudProfileStore(settings);
  profiles.setLayout('flight', { instruments: { x: 0.1, y: 0.2 } });
  profiles.setLayout('navigation', { map: { x: 0.6, y: 0.4 } });
  profiles.setLayout('combat', { aim: { x: 0.3, y: 0.8 } });
  profiles.setLayout('warp', { telemetry: { x: 0.7, y: 0.1 } });
  profiles.resetLayout('navigation');
  assert.deepEqual(profiles.getLayout('flight'), { instruments: { x: 0.1, y: 0.2 } });
  assert.deepEqual(profiles.getLayout('navigation'), {});
  assert.deepEqual(profiles.getLayout('combat'), { aim: { x: 0.3, y: 0.8 } });
  assert.deepEqual(profiles.getLayout('warp'), { telemetry: { x: 0.7, y: 0.1 } });
});

test('selecionar um perfil não altera configurações salvas', () => {
  const settings = { pilotHudProfiles: { flight: { a: { x: 1, y: 1 } } } };
  const profiles = createPilotHudProfileStore(settings);
  const before = structuredClone(settings);
  profiles.select('combat');
  assert.equal(profiles.activeProfile, 'combat');
  assert.deepEqual(settings, before);
});

test('perfil desconhecido é rejeitado', () => {
  const profiles = createPilotHudProfileStore({});
  assert.throws(() => profiles.select('sensor'), /Perfil de HUD desconhecido/);
});
