import test from 'node:test';
import assert from 'node:assert/strict';
import { projectSensorContacts } from './navigationSensorMap.js';

const ship = { x: 0, y: 0, z: 0 };
const telemetry = {
  enabled: true,
  operational: true,
  contacts: [
    {
      id: 'dilithium-field',
      distance: 100,
      position: { x: 0, y: 0, z: -100 },
      ore: 8,
      resources: [{ resourceId: 'ore.dilithium.raw', amount: 12, purity: 0.9 }]
    },
    {
      id: 'starboard-ore',
      distance: 200,
      position: { x: 200, y: 0, z: 0 },
      ore: 4,
      resources: []
    },
    {
      id: 'outside',
      distance: 900,
      position: { x: 900, y: 0, z: 0 },
      ore: 10,
      resources: []
    }
  ]
};

test('mapa projeta depósitos minerais no referencial de frente e estibordo da nave', () => {
  const result = projectSensorContacts({ telemetry, shipPosition: ship, heading: 0, range: 650 });
  assert.equal(result.available, true);
  assert.equal(result.totalContacts, 2);
  assert.equal(result.outOfRange, 1);
  assert.equal(result.markers[0].id, 'dilithium-field');
  assert.equal(result.markers[0].label, 'DILÍTIO');
  assert.ok(result.markers[0].y < 160, 'contato à frente deve aparecer acima da nave');
  assert.ok(result.markers[1].x > 160, 'contato a estibordo deve aparecer à direita');
});

test('mapa acompanha a rotação da nave sem alterar a posição dos contatos', () => {
  const rotatedTelemetry = {
    ...telemetry,
    contacts: [{
      id: 'forward-after-turn',
      distance: 100,
      position: { x: -100, y: 0, z: 0 },
      ore: 5,
      resources: []
    }]
  };
  const result = projectSensorContacts({ telemetry: rotatedTelemetry, shipPosition: ship, heading: Math.PI / 2, range: 650 });
  const forward = result.markers[0];
  assert.ok(Math.abs(forward.x - 160) < 2);
  assert.ok(forward.y < 160, 'o contato à frente deve permanecer acima da nave após rotação');
});

test('sensores desligados ou sem energia não publicam marcadores', () => {
  const disabled = projectSensorContacts({
    telemetry: { enabled: false, operational: false, contacts: telemetry.contacts },
    shipPosition: ship
  });
  const noPower = projectSensorContacts({
    telemetry: { enabled: true, operational: false, contacts: telemetry.contacts },
    shipPosition: ship
  });
  assert.equal(disabled.available, false);
  assert.equal(disabled.markers.length, 0);
  assert.equal(disabled.status, 'SENSORES DESLIGADOS');
  assert.equal(noPower.status, 'SENSORES SEM ENERGIA');
});

test('contatos sem posição ou sem minério não são desenhados', () => {
  const result = projectSensorContacts({
    telemetry: {
      enabled: true,
      operational: true,
      contacts: [
        { id: 'no-position', ore: 5 },
        { id: 'empty', position: { x: 4, y: 0, z: 4 }, ore: 0, resources: [] }
      ]
    },
    shipPosition: ship
  });
  assert.equal(result.totalContacts, 0);
});
