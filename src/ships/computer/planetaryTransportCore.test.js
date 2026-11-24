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
