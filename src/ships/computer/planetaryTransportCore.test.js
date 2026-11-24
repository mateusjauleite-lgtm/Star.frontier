import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlanetaryTransportCore } from './planetaryTransportCore.js';

test('registra e pesquisa destinos georreferenciados', () => {
  const actor = { name: 'ship' };
  const core = createPlanetaryTransportCore({
    resolveDestination: destination => ({ position: { x: destination.longitudeDeg, y: 10, z: destination.latitudeDeg } }),
    moveActor: () => true,
    getActors: () => ({ ship: actor })
  });
  core.registerDestination({ id: 'jaú', name: 'Jaú - área de teste', latitudeDeg: -22.29, longitudeDeg: -48.56 });
  assert.equal(core.findDestinations('jau').length, 1);
  assert.equal(core.getStatus().destinationCount, 1);
});

test('teleporta somente para destinos registrados e resolvidos', () => {
  const actor = { position: null };
  const core = createPlanetaryTransportCore({
    resolveDestination: destination => ({ position: { x: destination.longitudeDeg, y: 50, z: destination.latitudeDeg } }),
    moveActor: (target, resolved) => { target.position = resolved.position; return true; },
    getActors: () => ({ ship: actor })
  });
  core.registerDestination({ id: 'site-1', latitudeDeg: 1, longitudeDeg: 2 });
  assert.equal(core.teleport('missing').reason, 'destination-not-found');
  assert.equal(core.teleport('site-1').ok, true);
  assert.deepEqual(actor.position, { x: 2, y: 50, z: 1 });
});

test('rejeita coordenadas inválidas e altitude negativa', () => {
  const core = createPlanetaryTransportCore({
    resolveDestination: () => ({ position: { x: 0, y: 0, z: 0 } }),
    moveActor: () => true,
    getActors: () => ({ ship: {} })
  });
  assert.throws(() => core.registerDestination({ id: 'bad', latitudeDeg: 120, longitudeDeg: 0 }));
  core.registerDestination({ id: 'ok', latitudeDeg: 0, longitudeDeg: 0 });
  assert.equal(core.teleport('ok', { altitudeOffsetMeters: -1 }).reason, 'invalid-altitude');
});


test('exige energia disponível e consome o barramento antes do transporte', () => {
  const actor = { position: null };
  let consumed = 0;
  const core = createPlanetaryTransportCore({
    resolveDestination: destination => ({ position: { x: destination.longitudeDeg, y: 2, z: destination.latitudeDeg } }),
    moveActor: (target, resolved) => { target.position = resolved.position; return true; },
    getActors: () => ({ character: actor }),
    energyCost: 8,
    getPowerStatus: () => ({ available: true, energy: 20, bus: 'OPERATIONS EPS' }),
    consumePower: amount => { consumed += amount; return amount; }
  });
  core.registerDestination({ id: 'jaú', name: 'Jaú', latitudeDeg: -22.29, longitudeDeg: -48.56 });
  const result = core.teleport('jaú', { actor: 'character', altitudeOffsetMeters: 2.2 });
  assert.equal(result.ok, true);
  assert.equal(consumed, 8);
  assert.deepEqual(actor.position, { x: -48.56, y: 2, z: -22.29 });
  assert.equal(core.getStatus().power.bus, 'OPERATIONS EPS');
});

test('bloqueia transporte sem energia sem mover o personagem', () => {
  let moved = false;
  const core = createPlanetaryTransportCore({
    resolveDestination: () => ({ position: { x: 1, y: 2, z: 3 } }),
    moveActor: () => { moved = true; return true; },
    getActors: () => ({ character: {} }),
    energyCost: 8,
    getPowerStatus: () => ({ available: true, energy: 2 }),
    consumePower: () => 0
  });
  core.registerDestination({ id: 'site', latitudeDeg: 0, longitudeDeg: 0 });
  assert.equal(core.teleport('site', { actor: 'character' }).reason, 'insufficient-power');
  assert.equal(moved, false);
});


test('pré-visualiza a coordenada geográfica sem mover o ator nem consumir energia', () => {
  const actor = { position: null };
  let moved = false;
  let consumed = 0;
  const core = createPlanetaryTransportCore({
    resolveDestination: destination => ({ position: { x: destination.longitudeDeg, y: 4, z: destination.latitudeDeg } }),
    moveActor: () => { moved = true; return true; },
    getActors: () => ({ character: actor }),
    consumePower: amount => { consumed += amount; return amount; },
    getPowerStatus: () => ({ available: true, energy: 20 })
  });
  core.registerDestination({ id: 'preview', latitudeDeg: -22, longitudeDeg: -48 });
  const preview = core.previewDestination('preview', { altitudeOffsetMeters: 2.2 });
  assert.equal(preview.ok, true);
  assert.deepEqual(preview.position, { x: -48, y: 4, z: -22 });
  assert.equal(moved, false);
  assert.equal(consumed, 0);
});
